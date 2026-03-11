import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();

  const sql = neon();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const compteId = url.searchParams.get("compte_id");
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    if (!compteId || !from || !to) {
      return new Response(
        JSON.stringify({ error: "compte_id, from, to requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const rows = await sql`
      SELECT t.id, t.date_transaction, t.description, t.type, t.total_ttc,
             t.rapproche, t.date_rapprochement,
             c.nom as categorie_nom, p.code as projet_code, co.nom as contact_nom
      FROM transactions t
      LEFT JOIN categories c ON t.categorie_id = c.id
      LEFT JOIN projets p ON t.projet_id = p.id
      LEFT JOIN contacts co ON t.contact_id = co.id
      WHERE t.compte_id = ${Number(compteId)}
        AND t.date_transaction >= ${from}
        AND t.date_transaction <= ${to}
      ORDER BY t.date_transaction ASC
    `;

    const aggregates = await sql`
      SELECT
        COALESCE(SUM(CASE WHEN rapproche = true AND type='revenu' THEN total_ttc ELSE 0 END), 0) as credits_rapproches,
        COALESCE(SUM(CASE WHEN rapproche = true AND type='dépense' THEN total_ttc ELSE 0 END), 0) as debits_rapproches,
        COALESCE(SUM(CASE WHEN rapproche = false AND type='revenu' THEN total_ttc ELSE 0 END), 0) as credits_en_attente,
        COALESCE(SUM(CASE WHEN rapproche = false AND type='dépense' THEN total_ttc ELSE 0 END), 0) as debits_en_attente
      FROM transactions
      WHERE compte_id = ${Number(compteId)}
        AND date_transaction >= ${from}
        AND date_transaction <= ${to}
    `;

    return Response.json({ rows, aggregates: aggregates[0] });
  }

  if (req.method === "PUT") {
    const data = await req.json();
    const { transaction_id, rapproche } = data;

    if (!transaction_id) {
      return new Response(
        JSON.stringify({ error: "transaction_id requis" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const result = await sql`
      UPDATE transactions
      SET rapproche = ${rapproche},
          date_rapprochement = CASE WHEN ${rapproche} THEN NOW()::date ELSE NULL END
      WHERE id = ${transaction_id}
      RETURNING id, rapproche, date_rapprochement
    `;

    return Response.json(result[0]);
  }

  if (req.method === "POST") {
    const data = await req.json();
    const result = await sql`
      INSERT INTO sessions_rapprochement (compte_id, date_releve, solde_releve, solde_systeme, ecart, notes)
      VALUES (${data.compte_id}, ${data.date_releve}, ${data.solde_releve},
              ${data.solde_systeme}, ${data.ecart}, ${data.notes || null})
      RETURNING *
    `;
    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/rapprochement" };
