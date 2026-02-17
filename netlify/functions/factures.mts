import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();

  const sql = neon();
  const url = new URL(req.url);

  if (req.method === "GET") {
    // Generate next invoice number
    const nextNumber = url.searchParams.get("next_number");
    if (nextNumber !== null) {
      const prefix = url.searchParams.get("prefix") || "JAXA";
      const year = new Date().getFullYear();
      const pattern = `${prefix}%${year}%`;
      const result = await sql`
        SELECT numero_facture FROM transactions
        WHERE numero_facture LIKE ${pattern}
        ORDER BY numero_facture DESC LIMIT 1
      `;
      let nextNum = 1;
      if (result.length > 0) {
        // Try to extract number from existing invoice numbers
        const existing = result[0].numero_facture;
        const match = existing.match(/(\d+)[^0-9]*$/);
        if (match) nextNum = parseInt(match[1]) + 1;
      }
      const padded = String(nextNum).padStart(2, "0");
      const dateStr = new Date()
        .toLocaleDateString("fr-CA", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
        .replace(/-/g, "");
      const suggested = `${prefix}_${padded}-${dateStr}`;
      return new Response(JSON.stringify({ suggested, nextNum }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // List invoices (revenu transactions with full contact info)
    const statut = url.searchParams.get("statut");
    const conditions: string[] = ["t.type = 'revenu'"];
    const params: unknown[] = [];
    let idx = 1;

    if (statut && statut !== "all") {
      if (statut === "sans_facture") {
        conditions.push("t.numero_facture IS NULL");
      } else {
        conditions.push(`t.statut_facture = $${idx++}`);
        params.push(statut);
      }
    }

    const where = conditions.join(" AND ");

    const rows = await sql.query(
      `SELECT t.*, c.nom as categorie_nom, p.code as projet_code,
              p.nom as projet_nom, co.nom as contact_nom,
              co.email as contact_email, co.telephone as contact_telephone,
              co.adresse as contact_adresse,
              cb.nom as compte_nom
       FROM transactions t
       LEFT JOIN categories c ON t.categorie_id = c.id
       LEFT JOIN projets p ON t.projet_id = p.id
       LEFT JOIN contacts co ON t.contact_id = co.id
       LEFT JOIN comptes_bancaires cb ON t.compte_id = cb.id
       WHERE ${where}
       ORDER BY t.date_transaction DESC`,
      params
    );

    // Summary counts
    const summary = await sql`
      SELECT
        COUNT(*) FILTER (WHERE numero_facture IS NOT NULL) as total,
        COUNT(*) FILTER (WHERE statut_facture = 'Payée') as payees,
        COUNT(*) FILTER (WHERE statut_facture IN ('Envoyée', 'En attente')) as en_attente,
        COUNT(*) FILTER (WHERE statut_facture = 'En retard') as en_retard,
        COALESCE(SUM(total_ttc) FILTER (WHERE statut_facture IN ('Envoyée', 'En attente', 'En retard')), 0) as montant_impaye
      FROM transactions
      WHERE type = 'revenu'
    `;

    return new Response(
      JSON.stringify({ rows, summary: summary[0] }),
      { headers: { "Content-Type": "application/json" } }
    );
  }

  if (req.method === "POST") {
    // Create a new invoice (revenu transaction with line items)
    const data = await req.json();
    const result = await sql`
      INSERT INTO transactions
        (date_transaction, type, description, categorie_id, projet_id,
         contact_id, compte_id, mode_paiement, montant_ht, tps, tvq, total_ttc,
         taxable, statut_facture, numero_facture, lignes_facture, ocr_source)
      VALUES (${data.date_transaction}, 'revenu', ${data.description},
              ${data.categorie_id || 14}, ${data.projet_id}, ${data.contact_id},
              ${data.compte_id}, ${data.mode_paiement || "Virement Interac"},
              ${data.montant_ht}, ${data.tps}, ${data.tvq}, ${data.total_ttc},
              ${data.taxable !== false}, ${data.statut_facture || "Envoyée"},
              ${data.numero_facture}, ${data.lignes_facture}, false)
      RETURNING *
    `;
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

    // Update invoice-specific fields
    const result = await sql`
      UPDATE transactions SET
        statut_facture = ${data.statut_facture},
        date_paiement = ${data.date_paiement || null},
        numero_facture = ${data.numero_facture || null},
        lignes_facture = ${data.lignes_facture || null},
        updated_at = NOW()
      WHERE id = ${data.id}
      RETURNING *
    `;

    return new Response(JSON.stringify(result[0]), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/factures" };
