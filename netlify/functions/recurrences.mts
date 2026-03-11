import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

function advanceDate(dateStr: string, frequence: string): string {
  const d = new Date(dateStr + "T12:00:00");
  if (frequence === "hebdomadaire") d.setDate(d.getDate() + 7);
  else if (frequence === "mensuel") d.setMonth(d.getMonth() + 1);
  else if (frequence === "trimestriel") d.setMonth(d.getMonth() + 3);
  else if (frequence === "annuel") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().split("T")[0];
}

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();

  const sql = neon();
  const url = new URL(req.url);

  if (req.method === "GET") {
    const rows = await sql`
      SELECT r.*, c.nom as categorie_nom, p.code as projet_code,
             co.nom as contact_nom, cb.nom as compte_nom
      FROM recurrences r
      LEFT JOIN categories c ON r.categorie_id = c.id
      LEFT JOIN projets p ON r.projet_id = p.id
      LEFT JOIN contacts co ON r.contact_id = co.id
      LEFT JOIN comptes_bancaires cb ON r.compte_id = cb.id
      ORDER BY r.prochaine_date ASC
    `;
    return Response.json(rows);
  }

  if (req.method === "POST") {
    const data = await req.json();

    // Generate due transactions
    if (data.action === "generate") {
      const today = new Date().toISOString().split("T")[0];
      const due = await sql`
        SELECT * FROM recurrences
        WHERE actif = true
          AND prochaine_date <= ${today}
          AND (date_fin IS NULL OR date_fin >= ${today})
      `;

      let generated = 0;
      for (const r of due) {
        await sql`
          INSERT INTO transactions
            (date_transaction, type, description, categorie_id, projet_id,
             contact_id, compte_id, mode_paiement, montant_ht, tps, tvq,
             total_ttc, taxable, notes, recurrence_id)
          VALUES (${r.prochaine_date}, ${r.type}, ${r.description}, ${r.categorie_id},
                  ${r.projet_id}, ${r.contact_id}, ${r.compte_id}, ${r.mode_paiement},
                  ${r.montant_ht}, ${r.tps}, ${r.tvq}, ${r.total_ttc}, ${r.taxable},
                  ${r.notes}, ${r.id})
        `;
        const next = advanceDate(r.prochaine_date, r.frequence);
        await sql`UPDATE recurrences SET prochaine_date = ${next} WHERE id = ${r.id}`;
        generated++;
      }

      return Response.json({ generated });
    }

    // Create new recurrence
    const result = await sql`
      INSERT INTO recurrences
        (type, description, categorie_id, projet_id, contact_id, compte_id,
         mode_paiement, montant_ht, tps, tvq, total_ttc, taxable, notes,
         frequence, date_debut, date_fin, prochaine_date, actif)
      VALUES (${data.type}, ${data.description}, ${data.categorie_id}, ${data.projet_id || null},
              ${data.contact_id || null}, ${data.compte_id || null}, ${data.mode_paiement},
              ${data.montant_ht}, ${data.tps}, ${data.tvq}, ${data.total_ttc}, ${data.taxable},
              ${data.notes || null}, ${data.frequence}, ${data.date_debut},
              ${data.date_fin || null}, ${data.prochaine_date || data.date_debut}, ${data.actif ?? true})
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

    const result = await sql`
      UPDATE recurrences SET
        type=${data.type}, description=${data.description},
        categorie_id=${data.categorie_id}, projet_id=${data.projet_id || null},
        contact_id=${data.contact_id || null}, compte_id=${data.compte_id || null},
        mode_paiement=${data.mode_paiement}, montant_ht=${data.montant_ht},
        tps=${data.tps}, tvq=${data.tvq}, total_ttc=${data.total_ttc},
        taxable=${data.taxable}, notes=${data.notes || null},
        frequence=${data.frequence}, date_debut=${data.date_debut},
        date_fin=${data.date_fin || null}, prochaine_date=${data.prochaine_date},
        actif=${data.actif}
      WHERE id=${data.id}
      RETURNING *
    `;
    return Response.json(result[0]);
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "ID requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    await sql`DELETE FROM recurrences WHERE id = ${Number(id)}`;
    return Response.json({ success: true });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/recurrences" };
