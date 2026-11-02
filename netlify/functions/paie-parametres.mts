import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { auteur, authorizePaie } from "./lib/auth.ts";
import { erreur, journaliser } from "./lib/paie.ts";

const REQUIS = ["rqap_taux_employeur", "rqap_max_assurable", "ae_ratio_employeur", "fss_taux", "cnt_taux", "cnt_max_assurable", "cnesst_taux"];
const OPTIONNELS = ["rqap_taux_employe", "ae_taux_employe", "ae_max_assurable", "rrq_taux", "rrq_exemption", "rrq_max_gains", "cnesst_max_assurable", "mpb_provincial", "mpb_federal"];

export default async (req: Request, _context: Context) => {
  const auth = authorizePaie(req);
  if (auth.denied) return auth.denied;
  const sql = neon();

  if (req.method === "GET") {
    return Response.json(await sql`SELECT * FROM paie_parametres ORDER BY annee DESC`);
  }

  if (req.method === "PUT") {
    const data = await req.json().catch(() => null);
    const annee = Number(data?.annee);
    if (!Number.isInteger(annee) || annee < 2020 || annee > 2100) return erreur("Année invalide");
    const v: Record<string, number | null> = {};
    for (const k of REQUIS) {
      const n = Number(data[k]);
      if (data[k] === "" || data[k] == null || !Number.isFinite(n) || n < 0) return erreur(`Valeur requise : ${k}`);
      v[k] = n;
    }
    for (const k of OPTIONNELS) {
      v[k] = data[k] === "" || data[k] == null ? null : Number(data[k]);
      if (v[k] !== null && !(Number.isFinite(v[k]) && v[k]! >= 0)) return erreur(`Valeur invalide : ${k}`);
    }
    const [avant] = await sql`SELECT * FROM paie_parametres WHERE annee = ${annee}`;
    const [apres] = await sql.transaction([
      sql`
        INSERT INTO paie_parametres (annee, rqap_taux_employe, rqap_taux_employeur, rqap_max_assurable,
          ae_taux_employe, ae_ratio_employeur, ae_max_assurable, rrq_taux, rrq_exemption, rrq_max_gains,
          fss_taux, cnt_taux, cnt_max_assurable, cnesst_taux, cnesst_max_assurable, mpb_provincial, mpb_federal)
        VALUES (${annee}, ${v.rqap_taux_employe}, ${v.rqap_taux_employeur}, ${v.rqap_max_assurable},
          ${v.ae_taux_employe}, ${v.ae_ratio_employeur}, ${v.ae_max_assurable}, ${v.rrq_taux}, ${v.rrq_exemption},
          ${v.rrq_max_gains}, ${v.fss_taux}, ${v.cnt_taux}, ${v.cnt_max_assurable}, ${v.cnesst_taux},
          ${v.cnesst_max_assurable}, ${v.mpb_provincial}, ${v.mpb_federal})
        ON CONFLICT (annee) DO UPDATE SET
          rqap_taux_employe = EXCLUDED.rqap_taux_employe, rqap_taux_employeur = EXCLUDED.rqap_taux_employeur,
          rqap_max_assurable = EXCLUDED.rqap_max_assurable, ae_taux_employe = EXCLUDED.ae_taux_employe,
          ae_ratio_employeur = EXCLUDED.ae_ratio_employeur, ae_max_assurable = EXCLUDED.ae_max_assurable,
          rrq_taux = EXCLUDED.rrq_taux, rrq_exemption = EXCLUDED.rrq_exemption,
          rrq_max_gains = EXCLUDED.rrq_max_gains, fss_taux = EXCLUDED.fss_taux, cnt_taux = EXCLUDED.cnt_taux,
          cnt_max_assurable = EXCLUDED.cnt_max_assurable, cnesst_taux = EXCLUDED.cnesst_taux,
          cnesst_max_assurable = EXCLUDED.cnesst_max_assurable, mpb_provincial = EXCLUDED.mpb_provincial,
          mpb_federal = EXCLUDED.mpb_federal, updated_at = NOW()
        RETURNING *
      `,
      journaliser(sql, "paie_parametres", annee, avant ? "modification" : "creation", auteur(auth.session), avant ?? null, v),
    ]);
    return Response.json(apres[0]);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/paie/parametres" };
