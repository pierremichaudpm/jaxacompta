import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();

  if (req.method === "GET") {
    const rows = await sql(`SELECT * FROM contacts ORDER BY nom`);
    return new Response(JSON.stringify(rows), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const data = await req.json();
    const result = await sql(`
      INSERT INTO contacts (nom, type, email, telephone, adresse, numero_tps, numero_tvq)
      VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `, [data.nom, data.type, data.email, data.telephone,
        data.adresse, data.numero_tps, data.numero_tvq]);
    return new Response(JSON.stringify(result[0]), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/contacts" };
