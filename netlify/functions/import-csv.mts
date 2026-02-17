import { neon } from "@netlify/neon";
import type { Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request) => {
  if (!verifyAuth(req)) return unauthorized();
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const sql = neon();
  const { transactions } = await req.json();

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return Response.json(
      { error: "Aucune transaction à importer" },
      { status: 400 },
    );
  }

  let imported = 0;
  const errors: string[] = [];

  for (const tx of transactions) {
    try {
      await sql`
        INSERT INTO transactions
          (date_transaction, type, description, categorie_id, projet_id,
           contact_id, compte_id, mode_paiement, montant_ht, tps, tvq,
           total_ttc, taxable, notes)
        VALUES (${tx.date_transaction}, ${tx.type}, ${tx.description}, ${tx.categorie_id},
                ${tx.projet_id}, ${tx.contact_id}, ${tx.compte_id}, ${tx.mode_paiement},
                ${tx.montant_ht}, ${tx.tps || 0}, ${tx.tvq || 0}, ${tx.total_ttc},
                ${tx.taxable !== false}, ${tx.notes})
      `;
      imported++;
    } catch (e) {
      errors.push(
        `Ligne ${imported + errors.length + 1}: ${e instanceof Error ? e.message : "Erreur"}`,
      );
    }
  }

  return Response.json({ imported, errors, total: transactions.length });
};

export const config: Config = { path: "/api/import-csv" };
