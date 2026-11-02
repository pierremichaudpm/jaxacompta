import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { auteur, authorizePaie } from "./lib/auth.ts";
import {
  avecDates, categorieSalaires, erreur, insererEcriture, insererSortieBanque, journaliser, lignesEcriture,
  montant, paieNumerique, reserverId,
} from "./lib/paie.ts";
import {
  dateLimiteDAS, detailRemise, ecritureRemise, equilibre, inverserEcriture, totalRemise,
  type Palier,
} from "../../src/lib/paieCalcul.ts";

const PAYABLE_A: Record<Palier, string> = {
  federal: "Receveur général du Canada",
  provincial: "Ministre du Revenu du Québec",
};

export default async (req: Request, _context: Context) => {
  const auth = authorizePaie(req);
  if (auth.denied) return auth.denied;
  const qui = auteur(auth.session);
  const sql = neon();
  const url = new URL(req.url);

  const paiesDuMois = async (mois: string, statuts: string[]) =>
    (await sql`
      SELECT * FROM paies
      WHERE date_trunc('month', date_paie) = ${mois}::date AND statut = ANY(${statuts})
      ORDER BY date_paie
    `).map(paieNumerique);

  if (req.method === "GET") {
    const annee = Number(url.searchParams.get("annee")) || new Date().getFullYear();
    const paies = (await sql`
      SELECT * FROM paies WHERE date_paie BETWEEN ${annee + "-01-01"} AND ${annee + "-12-31"}
    `).map(paieNumerique);
    const remises = (await sql`
      SELECT r.*, cb.nom AS compte_nom
      FROM remises_das r LEFT JOIN comptes_bancaires cb ON cb.id = r.compte_bancaire_id
      WHERE r.mois BETWEEN ${annee + "-01-01"} AND ${annee + "-12-01"}
    `).map((r) => ({ ...avecDates(r, ["mois", "date_limite", "date_paiement"]), montant: montant(r.montant) }));
    const mois = [...new Set(paies.map((p) => `${String(p.date_paie).slice(0, 7)}-01`))].sort();
    return Response.json(mois.map((m) => {
      const duMois = paies.filter((p) => String(p.date_paie).startsWith(m.slice(0, 7)));
      const comptabilisees = duMois.filter((p) => ["comptabilisee", "das_payees"].includes(p.statut));
      const palier = (pl: Palier) => {
        const remise = remises.find((r) => r.mois === m && r.palier === pl) ?? null;
        const detail = remise ? remise.detail : detailRemise(pl, comptabilisees);
        return { payable_a: PAYABLE_A[pl], detail, total: totalRemise(detail), remise };
      };
      return {
        mois: m,
        date_limite: dateLimiteDAS(m),
        masse_salariale: montant(comptabilisees.reduce((t, p) => t + p.brut, 0)),
        nb_employes: new Set(comptabilisees.map((p) => p.employe_id)).size,
        nb_paies: comptabilisees.length,
        nb_non_comptabilisees: duMois.length - comptabilisees.length,
        dates_paie: comptabilisees.map((p) => p.date_paie),
        federal: palier("federal"),
        provincial: palier("provincial"),
      };
    }));
  }

  if (req.method === "POST") {
    const data = await req.json().catch(() => null);
    if (!data || data.action !== "payer") return erreur("Action inconnue");
    const palier = data.palier as Palier;
    const mois = String(data.mois || "");
    if (!PAYABLE_A[palier] || !/^\d{4}-\d{2}-01$/.test(mois)) return erreur("Mois ou palier invalide");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date_paiement || ""))) return erreur("Date de paiement requise");
    const compteId = Number(data.compte_bancaire_id);
    if (!compteId) return erreur("Choisissez le compte bancaire du paiement");
    const [existe] = await sql`SELECT id FROM remises_das WHERE mois = ${mois} AND palier = ${palier}`;
    if (existe) return erreur("Cette remise est déjà payée");
    const brouillons = await paiesDuMois(mois, ["brouillon", "validee"]);
    if (brouillons.length) return erreur("Des paies du mois ne sont pas comptabilisées");
    const paies = await paiesDuMois(mois, ["comptabilisee", "das_payees"]);
    if (!paies.length) return erreur("Aucune paie comptabilisée ce mois-ci");

    const detail = detailRemise(palier, paies);
    const total = totalRemise(detail);
    const libelle = `Remise DAS ${palier === "federal" ? "fédérale" : "provinciale"} ${mois.slice(0, 7)} — ${PAYABLE_A[palier]}`;
    const requetes = [];
    let ecritureId: number | null = null;
    let transactionId: number | null = null;
    // Remise à zéro : on la consigne sans écriture ni sortie de banque
    if (total > 0) {
      const lignes = ecritureRemise(detail);
      if (!equilibre(lignes).equilibre) return erreur("Écriture de remise déséquilibrée");
      ecritureId = await reserverId(sql, "ecritures");
      transactionId = await reserverId(sql, "transactions");
      requetes.push(
        ...insererEcriture(sql, {
          id: ecritureId, date: data.date_paiement, libelle, source: "remise_das", sourceId: null,
          auteur: qui, compteBancaireId: compteId,
        }, lignes),
        insererSortieBanque(sql, {
          id: transactionId, date: data.date_paiement, description: libelle, compteId,
          montant: total, categorieId: await categorieSalaires(sql),
        }),
      );
    }
    const autre = palier === "federal" ? "provincial" : "federal";
    // Écriture et sortie de banque d'abord : la remise y fait référence (clés étrangères)
    const resultats = await sql.transaction([
      ...requetes,
      sql`
        INSERT INTO remises_das (mois, palier, montant, detail, date_limite, date_paiement,
          compte_bancaire_id, demande_par, approuve_par, ecriture_id, transaction_id)
        VALUES (${mois}, ${palier}, ${total}, ${JSON.stringify(detail)}::jsonb, ${dateLimiteDAS(mois)},
          ${data.date_paiement}, ${compteId}, ${data.demande_par || null}, ${data.approuve_par || null},
          ${ecritureId}, ${transactionId})
        RETURNING *
      `,
      sql`UPDATE ecritures SET source_id = (SELECT id FROM remises_das WHERE mois = ${mois} AND palier = ${palier})
          WHERE id = ${ecritureId ?? 0}`,
      sql`
        UPDATE paies SET statut = 'das_payees', updated_at = NOW()
        WHERE date_trunc('month', date_paie) = ${mois}::date AND statut = 'comptabilisee'
          AND EXISTS (SELECT 1 FROM remises_das WHERE mois = ${mois} AND palier = ${autre})
      `,
      journaliser(sql, "remises_das", null, "paiement", qui, null, { mois, palier, total, detail, date_paiement: data.date_paiement }),
    ]);
    const remise = resultats[requetes.length][0];
    return Response.json({ ...avecDates(remise, ["mois", "date_limite", "date_paiement"]), montant: montant(remise.montant) }, { status: 201 });
  }

  if (req.method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    const [ligne] = await sql`SELECT * FROM remises_das WHERE id = ${id}`;
    const remise = ligne && avecDates(ligne, ["mois", "date_limite", "date_paiement"]);
    if (!remise) return erreur("Remise introuvable", 404);
    if (remise.transaction_id) {
      const [t] = await sql`SELECT rapproche FROM transactions WHERE id = ${remise.transaction_id}`;
      if (t?.rapproche) return erreur("Le paiement est rapproché : défaites le rapprochement d'abord");
    }
    const requetes = [];
    if (remise.ecriture_id) {
      const ecritureId = await reserverId(sql, "ecritures");
      requetes.push(
        ...insererEcriture(sql, {
          id: ecritureId, date: new Date().toISOString().slice(0, 10),
          libelle: `Annulation de l'écriture #${remise.ecriture_id} (remise DAS ${String(remise.mois).slice(0, 7)})`,
          source: "annulation", sourceId: remise.id, annuleId: remise.ecriture_id, auteur: qui,
          compteBancaireId: remise.compte_bancaire_id,
        }, inverserEcriture(await lignesEcriture(sql, remise.ecriture_id))),
        sql`UPDATE ecritures SET annulee = true WHERE id = ${remise.ecriture_id}`,
      );
    }
    await sql.transaction([
      ...requetes,
      sql`DELETE FROM remises_das WHERE id = ${id}`,
      sql`DELETE FROM transactions WHERE id = ${remise.transaction_id ?? 0}`,
      sql`UPDATE paies SET statut = 'comptabilisee', updated_at = NOW()
          WHERE date_trunc('month', date_paie) = ${remise.mois}::date AND statut = 'das_payees'`,
      journaliser(sql, "remises_das", id, "annulation", qui, remise, null),
    ]);
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/paie/das" };
