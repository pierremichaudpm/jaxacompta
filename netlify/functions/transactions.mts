import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();

  const sql = neon();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const projet = url.searchParams.get("projet");
    const categorie = url.searchParams.get("categorie");
    const compte = url.searchParams.get("compte");
    const dateFrom = url.searchParams.get("from");
    const dateTo = url.searchParams.get("to");
    const search = url.searchParams.get("q");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Build dynamic query with sql.query()
    const conditions: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (projet) {
      conditions.push(`t.projet_id = $${idx++}`);
      params.push(Number(projet));
    }
    if (categorie) {
      conditions.push(`t.categorie_id = $${idx++}`);
      params.push(Number(categorie));
    }
    if (compte) {
      conditions.push(`t.compte_id = $${idx++}`);
      params.push(Number(compte));
    }
    if (dateFrom) {
      conditions.push(`t.date_transaction >= $${idx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`t.date_transaction <= $${idx++}`);
      params.push(dateTo);
    }
    if (search) {
      conditions.push(`(t.description ILIKE $${idx} OR co.nom ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }

    const where =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const countResult = await sql.query(
      `SELECT COUNT(*) as total FROM transactions t
       LEFT JOIN contacts co ON t.contact_id = co.id
       ${where}`,
      params,
    );
    const total = Number(countResult[0].total);

    const rows = await sql.query(
      `SELECT t.*, c.nom as categorie_nom, p.code as projet_code,
              p.nom as projet_nom, co.nom as contact_nom, cb.nom as compte_nom
       FROM transactions t
       LEFT JOIN categories c ON t.categorie_id = c.id
       LEFT JOIN projets p ON t.projet_id = p.id
       LEFT JOIN contacts co ON t.contact_id = co.id
       LEFT JOIN comptes_bancaires cb ON t.compte_id = cb.id
       ${where}
       ORDER BY t.date_transaction DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      [...params, limit, offset],
    );

    return new Response(JSON.stringify({ rows, total }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const result = await sql`
      INSERT INTO transactions
        (date_transaction, type, numero, description, categorie_id, projet_id,
         contact_id, compte_id, mode_paiement, montant_ht, tps, tvq, total_ttc,
         taxable, statut_facture, numero_facture, piece_jointe_url,
         ocr_source, ocr_confiance, notes)
      VALUES (${data.date_transaction}, ${data.type}, ${data.numero}, ${data.description},
              ${data.categorie_id}, ${data.projet_id}, ${data.contact_id}, ${data.compte_id},
              ${data.mode_paiement}, ${data.montant_ht}, ${data.tps}, ${data.tvq}, ${data.total_ttc},
              ${data.taxable}, ${data.statut_facture}, ${data.numero_facture},
              ${data.piece_jointe_url}, ${data.ocr_source}, ${data.ocr_confiance}, ${data.notes})
      RETURNING *
    `;

    if (data.projets_ids && data.projets_ids.length > 1) {
      for (const pid of data.projets_ids) {
        await sql`INSERT INTO transaction_projets (transaction_id, projet_id) VALUES (${result[0].id}, ${pid})`;
      }
    }

    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "PUT") {
    const data = await req.json();
    if (!data.id) {
      return new Response(JSON.stringify({ error: "ID requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await sql`
      UPDATE transactions SET
        date_transaction=${data.date_transaction}, type=${data.type}, numero=${data.numero},
        description=${data.description}, categorie_id=${data.categorie_id}, projet_id=${data.projet_id},
        contact_id=${data.contact_id}, compte_id=${data.compte_id}, mode_paiement=${data.mode_paiement},
        montant_ht=${data.montant_ht}, tps=${data.tps}, tvq=${data.tvq}, total_ttc=${data.total_ttc},
        taxable=${data.taxable}, statut_facture=${data.statut_facture}, numero_facture=${data.numero_facture},
        piece_jointe_url=${data.piece_jointe_url}, notes=${data.notes}, updated_at=NOW()
      WHERE id=${data.id}
      RETURNING *
    `;

    return new Response(JSON.stringify(result[0]), {
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
    await sql`DELETE FROM transactions WHERE id = ${Number(id)}`;
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/transactions" };
