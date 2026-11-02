import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { auteur, authorizePaie } from "./lib/auth.ts";
import {
  categorieSalaires, chargerParametres, erreur, insererEcriture, insererSortieBanque, journaliser,
  lignesEcriture, montant, paieNumerique, reserverId,
} from "./lib/paie.ts";
import { calculerPaie, ecriturePaie, equilibre, inverserEcriture, moisDe } from "../../src/lib/paieCalcul.ts";

const SAISIE = ["brut", "ae", "rqap", "rrq", "impot_federal", "impot_provincial", "fss"] as const;
const MODIFIABLE = ["brouillon", "validee"];

export default async (req: Request, _context: Context) => {
  const auth = authorizePaie(req);
  if (auth.denied) return auth.denied;
  const qui = auteur(auth.session);
  const sql = neon();
  const url = new URL(req.url);

  // Cumulatifs depuis le début de l'année, avant la date de paie (à reporter dans le calculateur)
  async function cumulatifs(employeId: number, date: string, exclureId: number | null) {
    const [c] = await sql`
      SELECT COALESCE(SUM(brut), 0) AS brut, COALESCE(SUM(rrq), 0) AS rrq,
             COALESCE(SUM(rqap), 0) AS rqap, COALESCE(SUM(ae), 0) AS ae,
             COALESCE(SUM(impot_federal), 0) AS impot_federal,
             COALESCE(SUM(impot_provincial), 0) AS impot_provincial
      FROM paies
      WHERE employe_id = ${employeId}
        AND date_paie >= ${date.slice(0, 4) + "-01-01"} AND date_paie < ${date}
        AND id <> ${exclureId ?? 0}
    `;
    return Object.fromEntries(Object.entries(c).map(([k, v]) => [k, montant(v)]));
  }

  // Valide la saisie et recalcule côté serveur tout ce qui en découle
  async function preparer(data: Record<string, unknown>, exclureId: number | null) {
    const employeId = Number(data.employe_id);
    const date = String(data.date_paie || "");
    if (!employeId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return { erreur: "Employé et date de paie requis" };
    const [employe] = await sql`SELECT * FROM employes WHERE id = ${employeId}`;
    if (!employe) return { erreur: "Employé introuvable" };
    const params = await chargerParametres(sql, Number(date.slice(0, 4)));
    if (!params) return { erreur: `Paramètres de paie ${date.slice(0, 4)} manquants (onglet Paramètres)` };
    const saisie = Object.fromEntries(SAISIE.map((k) => [k, montant(data[k])])) as Record<(typeof SAISIE)[number], number>;
    if (saisie.brut <= 0 || SAISIE.some((k) => saisie[k] < 0)) return { erreur: "Montants invalides" };
    if (!employe.assujetti_ae && saisie.ae !== 0) {
      return { erreur: "Cet employé n'est pas assujetti à l'assurance-emploi : A-E doit être 0" };
    }
    const cumul = await cumulatifs(employeId, date, exclureId);
    const calc = calculerPaie(saisie, params, {
      cumul_brut_avant: cumul.brut,
      assujetti_cnesst: employe.assujetti_cnesst,
      taux_vacances: Number(employe.taux_vacances),
    });
    if (calc.net < 0) return { erreur: "Le salaire net ne peut pas être négatif" };
    return {
      employe,
      valeurs: {
        employe_id: employeId,
        date_paie: date,
        periode_debut: data.periode_debut || null,
        periode_fin: data.periode_fin || null,
        heures: data.heures === "" || data.heures == null ? null : Number(data.heures),
        ...saisie,
        net_reference: data.net_reference === "" || data.net_reference == null ? null : montant(data.net_reference),
        ...calc,
        compte_bancaire_id: data.compte_bancaire_id ? Number(data.compte_bancaire_id) : employe.compte_bancaire_id,
        piece_jointe_key: data.piece_jointe_key || null,
        piece_jointe_nom: data.piece_jointe_nom || null,
        notes: data.notes || null,
      },
    };
  }

  async function chargerPaie(id: number) {
    const [p] = await sql`SELECT * FROM paies WHERE id = ${id}`;
    return p ? paieNumerique(p) : null;
  }

  async function dasPayees(date: string) {
    const rows = await sql`SELECT palier FROM remises_das WHERE mois = ${moisDe(date)}`;
    return rows.length > 0;
  }

  if (req.method === "GET") {
    if (url.searchParams.get("cumulatifs")) {
      const employeId = Number(url.searchParams.get("employe_id"));
      const date = url.searchParams.get("date") || "";
      if (!employeId || !date) return erreur("Employé et date requis");
      return Response.json(await cumulatifs(employeId, date, Number(url.searchParams.get("exclure")) || null));
    }
    const annee = Number(url.searchParams.get("annee")) || new Date().getFullYear();
    const rows = await sql`
      SELECT p.*, e.prenom, e.nom, e.actionnaire, cb.nom AS compte_nom
      FROM paies p
      JOIN employes e ON e.id = p.employe_id
      LEFT JOIN comptes_bancaires cb ON cb.id = p.compte_bancaire_id
      WHERE date_paie BETWEEN ${annee + "-01-01"} AND ${annee + "-12-31"}
      ORDER BY date_paie DESC, p.id DESC
    `;
    return Response.json(rows.map(paieNumerique));
  }

  if (req.method === "POST") {
    const data = await req.json().catch(() => null);
    if (!data) return erreur("Requête invalide");

    if (data.action) {
      const paie = await chargerPaie(Number(data.id));
      if (!paie) return erreur("Paie introuvable", 404);

      if (data.action === "valider" || data.action === "devalider") {
        const [de, vers] = data.action === "valider" ? ["brouillon", "validee"] : ["validee", "brouillon"];
        if (paie.statut !== de) return erreur("Statut incompatible");
        const [maj] = await sql.transaction([
          sql`UPDATE paies SET statut = ${vers}, updated_at = NOW() WHERE id = ${paie.id} RETURNING *`,
          journaliser(sql, "paies", paie.id, data.action, qui, { statut: de }, { statut: vers }),
        ]);
        return Response.json(maj[0]);
      }

      if (data.action === "comptabiliser") {
        if (paie.statut !== "validee") return erreur("Seule une paie validée peut être comptabilisée");
        if (!paie.compte_bancaire_id) return erreur("Choisissez le compte bancaire du salaire net");
        if (await dasPayees(paie.date_paie)) return erreur("Les DAS de ce mois sont déjà payées");
        const lignes = ecriturePaie(paie);
        const eq = equilibre(lignes);
        if (!eq.equilibre) return erreur(`Écriture déséquilibrée (débits ${eq.debit} / crédits ${eq.credit}) : comptabilisation bloquée`);
        const [employe] = await sql`SELECT prenom, nom FROM employes WHERE id = ${paie.employe_id}`;
        const libelle = `Paie ${employe.prenom} ${employe.nom} du ${paie.date_paie}`;
        const ecritureId = await reserverId(sql, "ecritures");
        const transactionId = await reserverId(sql, "transactions");
        await sql.transaction([
          ...insererEcriture(sql, {
            id: ecritureId, date: paie.date_paie, libelle, source: "paie", sourceId: paie.id,
            auteur: qui, compteBancaireId: paie.compte_bancaire_id,
          }, lignes),
          insererSortieBanque(sql, {
            id: transactionId, date: paie.date_paie, description: `${libelle} — salaire net`,
            compteId: paie.compte_bancaire_id, montant: paie.net, categorieId: await categorieSalaires(sql),
          }),
          sql`UPDATE paies SET statut = 'comptabilisee', ecriture_id = ${ecritureId},
                transaction_id = ${transactionId}, updated_at = NOW() WHERE id = ${paie.id}`,
          journaliser(sql, "paies", paie.id, "comptabiliser", qui, { statut: "validee" },
            { statut: "comptabilisee", ecriture_id: ecritureId, transaction_id: transactionId }),
        ]);
        return Response.json(await chargerPaie(paie.id));
      }

      if (data.action === "annuler") {
        if (paie.statut !== "comptabilisee" && paie.statut !== "das_payees" || !paie.ecriture_id) {
          return erreur("Cette paie n'est pas comptabilisée");
        }
        // Une remise payée (même un seul palier) repose sur cette paie
        if (await dasPayees(paie.date_paie)) return erreur("Annulez d'abord les remises DAS payées pour ce mois");
        if (paie.transaction_id) {
          const [t] = await sql`SELECT rapproche FROM transactions WHERE id = ${paie.transaction_id}`;
          if (t?.rapproche) return erreur("La sortie de banque du salaire est rapprochée : défaites le rapprochement d'abord");
        }
        const lignes = inverserEcriture(await lignesEcriture(sql, paie.ecriture_id));
        const ecritureId = await reserverId(sql, "ecritures");
        const today = new Date().toISOString().slice(0, 10);
        await sql.transaction([
          ...insererEcriture(sql, {
            id: ecritureId, date: today, libelle: `Annulation de l'écriture #${paie.ecriture_id} (paie du ${paie.date_paie})`,
            source: "annulation", sourceId: paie.id, annuleId: paie.ecriture_id, auteur: qui,
            compteBancaireId: paie.compte_bancaire_id,
          }, lignes),
          sql`UPDATE ecritures SET annulee = true WHERE id = ${paie.ecriture_id}`,
          sql`DELETE FROM transactions WHERE id = ${paie.transaction_id ?? 0}`,
          sql`UPDATE paies SET statut = 'brouillon', ecriture_id = NULL, transaction_id = NULL, updated_at = NOW()
              WHERE id = ${paie.id}`,
          journaliser(sql, "paies", paie.id, "annuler", qui,
            { statut: "comptabilisee", ecriture_id: paie.ecriture_id }, { statut: "brouillon", ecriture_annulation_id: ecritureId }),
        ]);
        return Response.json(await chargerPaie(paie.id));
      }

      return erreur("Action inconnue");
    }

    const prep = await preparer(data, null);
    if ("erreur" in prep) return erreur(prep.erreur as string);
    const v = prep.valeurs;
    const [creee] = await sql`
      INSERT INTO paies (employe_id, date_paie, periode_debut, periode_fin, heures, brut, ae, rqap, rrq,
        impot_federal, impot_provincial, fss, net_reference, net, rqap_employeur, rrq_employeur,
        ae_employeur, cnt, cnesst, vacances, das_federal, das_provincial, compte_bancaire_id,
        piece_jointe_key, piece_jointe_nom, notes)
      VALUES (${v.employe_id}, ${v.date_paie}, ${v.periode_debut}, ${v.periode_fin}, ${v.heures}, ${v.brut},
        ${v.ae}, ${v.rqap}, ${v.rrq}, ${v.impot_federal}, ${v.impot_provincial}, ${v.fss}, ${v.net_reference},
        ${v.net}, ${v.rqap_employeur}, ${v.rrq_employeur}, ${v.ae_employeur}, ${v.cnt}, ${v.cnesst},
        ${v.vacances}, ${v.das_federal}, ${v.das_provincial}, ${v.compte_bancaire_id},
        ${v.piece_jointe_key}, ${v.piece_jointe_nom}, ${v.notes})
      RETURNING *
    `;
    await journaliser(sql, "paies", creee.id, "creation", qui, null, creee);
    return Response.json(paieNumerique(creee), { status: 201 });
  }

  if (req.method === "PUT") {
    const data = await req.json().catch(() => null);
    const avant = data?.id ? await chargerPaie(Number(data.id)) : null;
    if (!avant) return erreur("Paie introuvable", 404);
    if (!MODIFIABLE.includes(avant.statut)) {
      return erreur("Paie comptabilisée : annulez l'écriture avant de la modifier");
    }
    const prep = await preparer(data, avant.id);
    if ("erreur" in prep) return erreur(prep.erreur as string);
    const v = prep.valeurs;
    const [apres] = await sql.transaction([
      sql`
        UPDATE paies SET employe_id = ${v.employe_id}, date_paie = ${v.date_paie},
          periode_debut = ${v.periode_debut}, periode_fin = ${v.periode_fin}, heures = ${v.heures},
          brut = ${v.brut}, ae = ${v.ae}, rqap = ${v.rqap}, rrq = ${v.rrq}, impot_federal = ${v.impot_federal},
          impot_provincial = ${v.impot_provincial}, fss = ${v.fss}, net_reference = ${v.net_reference},
          net = ${v.net}, rqap_employeur = ${v.rqap_employeur}, rrq_employeur = ${v.rrq_employeur},
          ae_employeur = ${v.ae_employeur}, cnt = ${v.cnt}, cnesst = ${v.cnesst}, vacances = ${v.vacances},
          das_federal = ${v.das_federal}, das_provincial = ${v.das_provincial},
          compte_bancaire_id = ${v.compte_bancaire_id}, piece_jointe_key = ${v.piece_jointe_key},
          piece_jointe_nom = ${v.piece_jointe_nom}, notes = ${v.notes},
          statut = 'brouillon', updated_at = NOW()
        WHERE id = ${avant.id} AND statut IN ('brouillon', 'validee')
        RETURNING *
      `,
      journaliser(sql, "paies", avant.id, "modification", qui, avant, v),
    ]);
    if (!apres[0]) return erreur("Paie modifiée entre-temps", 409);
    return Response.json(paieNumerique(apres[0]));
  }

  if (req.method === "DELETE") {
    const avant = await chargerPaie(Number(url.searchParams.get("id")));
    if (!avant) return erreur("Paie introuvable", 404);
    if (!MODIFIABLE.includes(avant.statut)) return erreur("Paie comptabilisée : suppression impossible");
    await sql.transaction([
      sql`DELETE FROM paies WHERE id = ${avant.id} AND statut IN ('brouillon', 'validee')`,
      journaliser(sql, "paies", avant.id, "suppression", qui, avant, null),
    ]);
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/paie" };
