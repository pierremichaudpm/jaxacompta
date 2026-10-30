import type { Context, Config } from "@netlify/functions";
import { issueToken, verifyReaderPassword } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const data = await req.json().catch(() => null);
  if (!data || typeof data.password !== "string" || !data.password || data.password.length > 1024 ||
    (data.email !== undefined && typeof data.email !== "string")) {
    return Response.json({ error: "Identifiants invalides" }, { status: 400 });
  }
  const { password } = data;
  const email = data.email?.trim().toLowerCase() || "";
  const APP_PASSWORD = Netlify.env.get("APP_PASSWORD");

  const authenticated = email ? verifyReaderPassword(email, password) : !!APP_PASSWORD && password === APP_PASSWORD;
  if (!authenticated) {
    return new Response(JSON.stringify({ error: "Identifiants incorrects" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = issueToken(undefined, email ? "reader" : "admin", email || undefined);

  return new Response(JSON.stringify({ token }), {
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { path: "/api/auth" };
