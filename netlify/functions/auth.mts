import type { Context, Config } from "@netlify/functions";
import { issueToken } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { password } = await req.json();
  const APP_PASSWORD = Netlify.env.get("APP_PASSWORD");

  if (password !== APP_PASSWORD) {
    return new Response(JSON.stringify({ error: "Mot de passe incorrect" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = issueToken();

  return new Response(JSON.stringify({ token }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { path: "/api/auth" };
