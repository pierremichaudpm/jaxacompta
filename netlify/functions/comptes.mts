import { neon } from "@netlify/neon";
import type { Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();

  const rows = await sql`
    SELECT cb.*,
      cb.solde_initial
      + COALESCE(SUM(CASE WHEN t.type = 'revenu' THEN t.total_ttc ELSE 0 END), 0)
      - COALESCE(SUM(CASE WHEN t.type = 'dépense' THEN t.total_ttc ELSE 0 END), 0)
      as solde_actuel
    FROM comptes_bancaires cb
    LEFT JOIN transactions t ON t.compte_id = cb.id
    GROUP BY cb.id
    ORDER BY cb.code
  `;

  return new Response(JSON.stringify(rows), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { path: "/api/comptes" };
