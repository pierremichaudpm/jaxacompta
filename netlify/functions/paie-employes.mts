import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { auteur, authorizePaie } from "./lib/auth.ts";
import { avecDates, erreur, journaliser } from "./lib/paie.ts";

const nombreOuNull = (v: unknown) => (v === "" || v == null ? null : Number(v));

function valider(data: Record<string, unknown>) {
  const prenom = String(data.prenom || "").trim();
  const nom = String(data.nom || "").trim();
  if (!prenom || !nom) return { erreur: "Prénom et nom requis" };
  const nas = String(data.nas_derniers3 || "").trim();
  if (nas && !/^\d{3}$/.test(nas)) return { erreur: "NAS : seulement les 3 derniers chiffres" };
  const periodes = Number(data.periodes_par_an || 26);
  if (![12, 24, 26, 52].includes(periodes)) return { erreur: "Fréquence de paie invalide" };
  const vacances = Number(data.taux_vacances ?? 0.04);
  if (!(vacances >= 0 && vacances <= 0.2)) return { erreur: "Taux de vacances invalide" };
  return {
    valeurs: {
      prenom, nom,
      actionnaire: !!data.actionnaire,
      statut: data.statut === "inactif" ? "inactif" : "actif",
      date_embauche: data.date_embauche || null,
      poste: data.poste || null,
      adresse: data.adresse || null,
      courriel: data.courriel || null,
      nas_derniers3: nas || null,
      taux_horaire: nombreOuNull(data.taux_horaire),
      heures_semaine: nombreOuNull(data.heures_semaine),
      periodes_par_an: periodes,
      mpb_provincial: nombreOuNull(data.mpb_provincial),
      mpb_federal: nombreOuNull(data.mpb_federal),
      assujetti_ae: data.assujetti_ae !== false,
      assujetti_cnesst: data.assujetti_cnesst !== false,
      taux_vacances: vacances,
      compte_bancaire_id: nombreOuNull(data.compte_bancaire_id),
      notes: data.notes || null,
    },
  };
}

export default async (req: Request, _context: Context) => {
  const auth = authorizePaie(req);
  if (auth.denied) return auth.denied;
  const qui = auteur(auth.session);
  const sql = neon();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const rows = await sql`
      SELECT e.*, cb.nom AS compte_nom,
             (SELECT COUNT(*)::int FROM paies p WHERE p.employe_id = e.id) AS nb_paies
      FROM employes e
      LEFT JOIN comptes_bancaires cb ON cb.id = e.compte_bancaire_id
      ORDER BY e.statut, e.nom, e.prenom
    `;
    return Response.json(rows.map((r) => avecDates(r, ["date_embauche"])));
  }

  if (req.method === "POST" || req.method === "PUT") {
    const data = await req.json().catch(() => null);
    if (!data) return erreur("Requête invalide");
    const res = valider(data);
    if ("erreur" in res) return erreur(res.erreur as string);
    const v = res.valeurs;

    if (req.method === "POST") {
      const [cree] = await sql`
        INSERT INTO employes (prenom, nom, actionnaire, statut, date_embauche, poste, adresse, courriel,
          nas_derniers3, taux_horaire, heures_semaine, periodes_par_an, mpb_provincial, mpb_federal,
          assujetti_ae, assujetti_cnesst, taux_vacances, compte_bancaire_id, notes)
        VALUES (${v.prenom}, ${v.nom}, ${v.actionnaire}, ${v.statut}, ${v.date_embauche}, ${v.poste},
          ${v.adresse}, ${v.courriel}, ${v.nas_derniers3}, ${v.taux_horaire}, ${v.heures_semaine},
          ${v.periodes_par_an}, ${v.mpb_provincial}, ${v.mpb_federal}, ${v.assujetti_ae},
          ${v.assujetti_cnesst}, ${v.taux_vacances}, ${v.compte_bancaire_id}, ${v.notes})
        RETURNING *
      `;
      await journaliser(sql, "employes", cree.id, "creation", qui, null, cree);
      return Response.json(cree, { status: 201 });
    }

    const [avant] = await sql`SELECT * FROM employes WHERE id = ${Number(data.id)}`;
    if (!avant) return erreur("Employé introuvable", 404);
    const [apres] = await sql.transaction([
      sql`
        UPDATE employes SET prenom = ${v.prenom}, nom = ${v.nom}, actionnaire = ${v.actionnaire},
          statut = ${v.statut}, date_embauche = ${v.date_embauche}, poste = ${v.poste}, adresse = ${v.adresse},
          courriel = ${v.courriel}, nas_derniers3 = ${v.nas_derniers3}, taux_horaire = ${v.taux_horaire},
          heures_semaine = ${v.heures_semaine}, periodes_par_an = ${v.periodes_par_an},
          mpb_provincial = ${v.mpb_provincial}, mpb_federal = ${v.mpb_federal},
          assujetti_ae = ${v.assujetti_ae}, assujetti_cnesst = ${v.assujetti_cnesst},
          taux_vacances = ${v.taux_vacances}, compte_bancaire_id = ${v.compte_bancaire_id},
          notes = ${v.notes}, updated_at = NOW()
        WHERE id = ${avant.id}
        RETURNING *
      `,
      journaliser(sql, "employes", avant.id, "modification", qui, avant, v),
    ]);
    return Response.json(apres[0]);
  }

  if (req.method === "DELETE") {
    const id = Number(url.searchParams.get("id"));
    const [avant] = await sql`SELECT * FROM employes WHERE id = ${id}`;
    if (!avant) return erreur("Employé introuvable", 404);
    const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM paies WHERE employe_id = ${id}`;
    if (n > 0) return erreur("Cet employé a des paies : passez-le plutôt au statut inactif");
    await sql.transaction([
      sql`DELETE FROM employes WHERE id = ${id}`,
      journaliser(sql, "employes", id, "suppression", qui, avant, null),
    ]);
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/paie/employes" };
