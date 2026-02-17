import { neon } from "@netlify/neon";
import type { Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();
  const rows = await sql`SELECT * FROM categories ORDER BY nom`;
  return new Response(JSON.stringify(rows), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { path: "/api/categories" };
