import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();

  if (req.method === "GET") {
    const rows = await sql(`
      SELECT p.*,
        COALESCE(SUM(CASE WHEN t.type = 'revenu' THEN t.total_ttc ELSE 0 END), 0) as revenus,
        COALESCE(SUM(CASE WHEN t.type = 'dépense' THEN t.total_ttc ELSE 0 END), 0) as depenses
      FROM projets p
      LEFT JOIN transactions t ON t.projet_id = p.id
      GROUP BY p.id
      ORDER BY p.statut, p.code
    `);
    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const result = await sql(`
      INSERT INTO projets (code, nom, statut, compte_dedie, date_debut, date_fin, budget)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [data.code, data.nom, data.statut || 'En cours', data.compte_dedie,
        data.date_debut, data.date_fin, data.budget]);
    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "PUT") {
    const data = await req.json();
    const result = await sql(`
      UPDATE projets SET nom=$1, statut=$2, compte_dedie=$3,
        date_debut=$4, date_fin=$5, budget=$6
      WHERE id=$7 RETURNING *
    `, [data.nom, data.statut, data.compte_dedie,
        data.date_debut, data.date_fin, data.budget, data.id]);
    return new Response(JSON.stringify(result[0]), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/projets" };
