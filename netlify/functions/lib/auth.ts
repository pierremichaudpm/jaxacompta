import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "admin" | "reader";
type Session = { authenticated: true; exp: number; role: Role; email?: string };

export function verifyReaderPassword(email: string, password: string): boolean {
  const allowedEmail = Netlify.env.get("READ_ONLY_EMAIL")?.trim().toLowerCase();
  const hash = Netlify.env.get("READ_ONLY_PASSWORD_HASH");
  if (!allowedEmail || email.trim().toLowerCase() !== allowedEmail || !hash) return false;
  const [salt, key] = hash.split(":");
  if (!salt || !/^[a-f0-9]{128}$/.test(key || "")) return false;
  const actual = scryptSync(password, salt, 64);
  return timingSafeEqual(actual, Buffer.from(key, "hex"));
}

function getSecret(): string {
  const secret = Netlify.env.get("APP_SECRET");
  if (!secret) throw new Error("APP_SECRET non configuré");
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function issueToken(ttlMs = 7 * 24 * 60 * 60 * 1000, role: Role = "admin", email?: string): string {
  const payloadB64 = btoa(JSON.stringify({
    authenticated: true,
    exp: Date.now() + ttlMs,
    role,
    ...(email ? { email } : {}),
  }));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function getSession(req: Request): Session | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  try {
    const [payloadB64, sig, extra] = authHeader.slice(7).split(".");
    if (!payloadB64 || !sig || extra !== undefined) return null;
    const expected = Buffer.from(sign(payloadB64));
    const actual = Buffer.from(sig);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return null;
    }
    const payload = JSON.parse(atob(payloadB64));
    if (payload.authenticated !== true || !Number.isFinite(payload.exp) || payload.exp <= Date.now()) return null;
    // Existing signed sessions predate roles and retain team access.
    const role = payload.role ?? "admin";
    if (role !== "admin" && role !== "reader") return null;
    if (role === "reader" && (!Netlify.env.get("READ_ONLY_PASSWORD_HASH") ||
      payload.email !== Netlify.env.get("READ_ONLY_EMAIL")?.trim().toLowerCase())) return null;
    return { ...payload, role };
  } catch {
    return null;
  }
}

// Every protected endpoint checks permissions before parsing a body or accessing storage.
export function authorizeRequest(req: Request): Response | null {
  const session = getSession(req);
  if (!session) return unauthorized();
  if (session.role === "reader" && req.method !== "GET" && req.method !== "HEAD") {
    return Response.json({ error: "Accès en lecture seule : modification non autorisée" }, { status: 403 });
  }
  return null;
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Non authentifié" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
