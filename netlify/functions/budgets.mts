import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();

  const sql = neon();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const annee = parseInt(url.searchParams.get("annee") || new Date().getFullYear().toString());
    const moisParam = url.searchParams.get("mois");

    let rows;
    if (moisParam) {
      const mois = parseInt(moisParam);
      rows = await sql`
        SELECT b.*, c.nom as categorie_nom, c.type as categorie_type,
               p.code as projet_code, p.nom as projet_nom,
               COALESCE((
                 SELECT SUM(t.total_ttc)
                 FROM transactions t
                 WHERE t.categorie_id = b.categorie_id
                   AND (b.projet_id IS NULL OR t.projet_id = b.projet_id)
                   AND EXTRACT(YEAR FROM t.date_transaction) = b.annee
                   AND EXTRACT(MONTH FROM t.date_transaction) = ${mois}
                   AND t.type = CASE WHEN c.type = 'revenu' THEN 'revenu' ELSE 'dépense' END
               ), 0) as depense_reelle
        FROM budgets b
        LEFT JOIN categories c ON b.categorie_id = c.id
        LEFT JOIN projets p ON b.projet_id = p.id
        WHERE b.annee = ${annee} AND b.mois = ${mois}
        ORDER BY c.nom
      `;
    } else {
      rows = await sql`
        SELECT b.*, c.nom as categorie_nom, c.type as categorie_type,
               p.code as projet_code, p.nom as projet_nom,
               COALESCE((
                 SELECT SUM(t.total_ttc)
                 FROM transactions t
                 WHERE t.categorie_id = b.categorie_id
                   AND (b.projet_id IS NULL OR t.projet_id = b.projet_id)
                   AND EXTRACT(YEAR FROM t.date_transaction) = b.annee
                   AND t.type = CASE WHEN c.type = 'revenu' THEN 'revenu' ELSE 'dépense' END
               ), 0) as depense_reelle
        FROM budgets b
        LEFT JOIN categories c ON b.categorie_id = c.id
        LEFT JOIN projets p ON b.projet_id = p.id
        WHERE b.annee = ${annee} AND b.mois IS NULL
        ORDER BY c.nom
      `;
    }

    return Response.json(rows);
  }

  if (req.method === "POST") {
    const data = await req.json();
    const result = await sql`
      INSERT INTO budgets (categorie_id, projet_id, annee, mois, montant, notes)
      VALUES (${data.categorie_id}, ${data.projet_id || null}, ${data.annee}, ${data.mois || null}, ${data.montant}, ${data.notes || null})
      ON CONFLICT (categorie_id, projet_id, annee, mois)
      DO UPDATE SET montant = ${data.montant}, notes = ${data.notes || null}
      RETURNING *
    `;
    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "ID requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await sql`DELETE FROM budgets WHERE id = ${Number(id)}`;
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/budgets" };
