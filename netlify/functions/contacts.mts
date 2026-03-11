import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();

  if (req.method === "GET") {
    const rows = await sql`SELECT * FROM contacts ORDER BY nom`;
    const parsed = rows.map((r: any) => {
      let adresses = [];
      try {
        adresses = r.adresses ? JSON.parse(r.adresses) : [];
      } catch {
        adresses = [];
      }
      return { ...r, adresses };
    });
    return new Response(JSON.stringify(parsed), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const adressesJson = data.adresses ? JSON.stringify(data.adresses) : "[]";
    const result = await sql`
      INSERT INTO contacts (nom, type, email, telephone, adresse, numero_tps, numero_tvq, adresses)
      VALUES (${data.nom}, ${data.type}, ${data.email}, ${data.telephone},
              ${data.adresse}, ${data.numero_tps}, ${data.numero_tvq}, ${adressesJson})
      RETURNING *
    `;
    const row = result[0] as any;
    let adresses = [];
    try { adresses = row.adresses ? JSON.parse(row.adresses) : []; } catch { adresses = []; }
    return new Response(JSON.stringify({ ...row, adresses }), {
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
    const adressesJson = data.adresses ? JSON.stringify(data.adresses) : "[]";
    const result = await sql`
      UPDATE contacts SET
        nom = ${data.nom}, type = ${data.type}, email = ${data.email},
        telephone = ${data.telephone}, adresse = ${data.adresse},
        numero_tps = ${data.numero_tps}, numero_tvq = ${data.numero_tvq},
        adresses = ${adressesJson}
      WHERE id = ${data.id}
      RETURNING *
    `;
    const row = result[0] as any;
    let adresses = [];
    try { adresses = row.adresses ? JSON.parse(row.adresses) : []; } catch { adresses = []; }
    return new Response(JSON.stringify({ ...row, adresses }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "DELETE") {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return new Response(JSON.stringify({ error: "ID requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    // Unlink transactions referencing this contact
    await sql`UPDATE transactions SET contact_id = NULL WHERE contact_id = ${id}`;
    await sql`DELETE FROM contacts WHERE id = ${id}`;
    return new Response(JSON.stringify({ ok: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/contacts" };
