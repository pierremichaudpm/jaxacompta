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
    const limit = url.searchParams.get("limit") || "50";
    const offset = url.searchParams.get("offset") || "0";

    const conditions: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;

    if (projet) {
      conditions.push(`t.projet_id = $${paramIdx++}`);
      params.push(Number(projet));
    }
    if (categorie) {
      conditions.push(`t.categorie_id = $${paramIdx++}`);
      params.push(Number(categorie));
    }
    if (compte) {
      conditions.push(`t.compte_id = $${paramIdx++}`);
      params.push(Number(compte));
    }
    if (dateFrom) {
      conditions.push(`t.date_transaction >= $${paramIdx++}`);
      params.push(dateFrom);
    }
    if (dateTo) {
      conditions.push(`t.date_transaction <= $${paramIdx++}`);
      params.push(dateTo);
    }
    if (search) {
      conditions.push(`(t.description ILIKE $${paramIdx} OR co.nom ILIKE $${paramIdx})`);
      params.push(`%${search}%`);
      paramIdx++;
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM transactions t
      LEFT JOIN contacts co ON t.contact_id = co.id
      ${where}
    `;
    const [{ total }] = await sql(countQuery, params);

    // Get rows
    const query = `
      SELECT t.*, c.nom as categorie_nom, p.code as projet_code,
             p.nom as projet_nom, co.nom as contact_nom, cb.nom as compte_nom
      FROM transactions t
      LEFT JOIN categories c ON t.categorie_id = c.id
      LEFT JOIN projets p ON t.projet_id = p.id
      LEFT JOIN contacts co ON t.contact_id = co.id
      LEFT JOIN comptes_bancaires cb ON t.compte_id = cb.id
      ${where}
      ORDER BY t.date_transaction DESC
      LIMIT $${paramIdx++} OFFSET $${paramIdx++}
    `;
    params.push(Number(limit), Number(offset));
    const rows = await sql(query, params);

    return new Response(JSON.stringify({ rows, total: Number(total) }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const result = await sql(`
      INSERT INTO transactions
        (date_transaction, type, numero, description, categorie_id, projet_id,
         contact_id, compte_id, mode_paiement, montant_ht, tps, tvq, total_ttc,
         taxable, statut_facture, numero_facture, piece_jointe_url,
         ocr_source, ocr_confiance, notes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [data.date_transaction, data.type, data.numero, data.description,
        data.categorie_id, data.projet_id, data.contact_id, data.compte_id,
        data.mode_paiement, data.montant_ht, data.tps, data.tvq, data.total_ttc,
        data.taxable, data.statut_facture, data.numero_facture,
        data.piece_jointe_url, data.ocr_source, data.ocr_confiance, data.notes]);

    if (data.projets_ids && data.projets_ids.length > 1) {
      for (const pid of data.projets_ids) {
        await sql(`INSERT INTO transaction_projets (transaction_id, projet_id)
                   VALUES ($1, $2)`, [result[0].id, pid]);
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

    const result = await sql(`
      UPDATE transactions SET
        date_transaction=$1, type=$2, numero=$3, description=$4,
        categorie_id=$5, projet_id=$6, contact_id=$7, compte_id=$8,
        mode_paiement=$9, montant_ht=$10, tps=$11, tvq=$12, total_ttc=$13,
        taxable=$14, statut_facture=$15, numero_facture=$16,
        piece_jointe_url=$17, notes=$18, updated_at=NOW()
      WHERE id=$19
      RETURNING *
    `, [data.date_transaction, data.type, data.numero, data.description,
        data.categorie_id, data.projet_id, data.contact_id, data.compte_id,
        data.mode_paiement, data.montant_ht, data.tps, data.tvq, data.total_ttc,
        data.taxable, data.statut_facture, data.numero_facture,
        data.piece_jointe_url, data.notes, data.id]);

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
    await sql(`DELETE FROM transactions WHERE id = $1`, [Number(id)]);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/transactions" };
