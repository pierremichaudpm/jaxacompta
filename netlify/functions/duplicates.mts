import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();

  const sql = neon();
  const url = new URL(req.url);

  // POST /api/duplicates — real-time check while filling the form
  if (req.method === "POST") {
    const data = await req.json();
    const { date_transaction, total_ttc, description, exclude_id } = data;

    if (!total_ttc || !date_transaction) {
      return Response.json([]);
    }

    let rows;
    if (description) {
      rows = await sql`
        SELECT t.id, t.date_transaction, t.description, t.total_ttc, t.type,
               c.nom as categorie_nom, p.code as projet_code
        FROM transactions t
        LEFT JOIN categories c ON t.categorie_id = c.id
        LEFT JOIN projets p ON t.projet_id = p.id
        WHERE ABS(t.total_ttc - ${total_ttc}) < 0.02
          AND t.date_transaction BETWEEN (${date_transaction}::date - INTERVAL '5 days')
                                      AND (${date_transaction}::date + INTERVAL '5 days')
          AND (t.description ILIKE ${'%' + description.slice(0, 30) + '%'}
               OR similarity(COALESCE(t.description, ''), ${description}) > 0.4)
          AND (${exclude_id}::int IS NULL OR t.id != ${exclude_id})
        ORDER BY t.date_transaction DESC
        LIMIT 5
      `;
    } else {
      rows = await sql`
        SELECT t.id, t.date_transaction, t.description, t.total_ttc, t.type,
               c.nom as categorie_nom, p.code as projet_code
        FROM transactions t
        LEFT JOIN categories c ON t.categorie_id = c.id
        LEFT JOIN projets p ON t.projet_id = p.id
        WHERE ABS(t.total_ttc - ${total_ttc}) < 0.02
          AND t.date_transaction BETWEEN (${date_transaction}::date - INTERVAL '5 days')
                                      AND (${date_transaction}::date + INTERVAL '5 days')
          AND (${exclude_id}::int IS NULL OR t.id != ${exclude_id})
        ORDER BY t.date_transaction DESC
        LIMIT 5
      `;
    }

    return Response.json(rows);
  }

  // GET /api/duplicates — full scan for duplicate review
  if (req.method === "GET") {
    const limit = parseInt(url.searchParams.get("limit") || "50");

    const rows = await sql`
      SELECT t1.id as id1, t1.date_transaction as date1,
             t1.description as desc1, t1.total_ttc as total1, t1.type as type1,
             t2.id as id2, t2.date_transaction as date2,
             t2.description as desc2, t2.total_ttc as total2, t2.type as type2
      FROM transactions t1
      JOIN transactions t2 ON t1.id < t2.id
        AND ABS(t1.total_ttc - t2.total_ttc) < 0.02
        AND t1.date_transaction BETWEEN t2.date_transaction - 5
                                     AND t2.date_transaction + 5
        AND (
          t1.description IS NOT NULL AND t2.description IS NOT NULL
          AND similarity(t1.description, t2.description) > 0.4
        )
      ORDER BY t1.date_transaction DESC
      LIMIT ${limit}
    `;

    return Response.json(rows);
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/duplicates" };
