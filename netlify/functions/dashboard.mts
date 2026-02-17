import { neon } from "@netlify/neon";
import type { Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();

  const [moisEnCours] = await sql(`
    SELECT
      COALESCE(SUM(CASE WHEN type = 'revenu' THEN total_ttc ELSE 0 END), 0) as revenus,
      COALESCE(SUM(CASE WHEN type = 'dépense' THEN total_ttc ELSE 0 END), 0) as depenses
    FROM transactions
    WHERE date_transaction >= date_trunc('month', CURRENT_DATE)
  `);

  const soldes = await sql(`
    SELECT cb.code, cb.nom, cb.institution,
      cb.solde_initial
      + COALESCE(SUM(CASE WHEN t.type = 'revenu' THEN t.total_ttc ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'dépense' THEN t.total_ttc ELSE 0 END), 0)
      as solde_actuel
    FROM comptes_bancaires cb
    LEFT JOIN transactions t ON t.compte_id = cb.id
    GROUP BY cb.id, cb.code, cb.nom, cb.institution, cb.solde_initial
  `);

  const evolution = await sql(`
    SELECT
      to_char(date_transaction, 'YYYY-MM') as mois,
      SUM(CASE WHEN type = 'revenu' THEN total_ttc ELSE 0 END) as revenus,
      SUM(CASE WHEN type = 'dépense' THEN total_ttc ELSE 0 END) as depenses
    FROM transactions
    WHERE date_transaction >= CURRENT_DATE - INTERVAL '12 months'
    GROUP BY to_char(date_transaction, 'YYYY-MM')
    ORDER BY mois
  `);

  const projets = await sql(`
    SELECT p.code, p.nom, p.statut,
      COALESCE(SUM(CASE WHEN t.type = 'revenu' THEN t.total_ttc ELSE 0 END), 0) as revenus,
      COALESCE(SUM(CASE WHEN t.type = 'dépense' THEN t.total_ttc ELSE 0 END), 0) as depenses
    FROM projets p
    LEFT JOIN transactions t ON t.projet_id = p.id
    WHERE p.statut = 'En cours'
    GROUP BY p.id, p.code, p.nom, p.statut
  `);

  const factures_retard = await sql(`
    SELECT t.*, co.nom as contact_nom, p.code as projet_code
    FROM transactions t
    LEFT JOIN contacts co ON t.contact_id = co.id
    LEFT JOIN projets p ON t.projet_id = p.id
    WHERE t.type = 'revenu'
      AND t.statut_facture IN ('Envoyée', 'En retard')
      AND t.date_transaction < CURRENT_DATE - INTERVAL '30 days'
  `);

  return new Response(JSON.stringify({
    mois: moisEnCours,
    soldes,
    evolution,
    projets,
    factures_retard,
  }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { path: "/api/dashboard" };
