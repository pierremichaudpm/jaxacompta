import { createHmac, scryptSync, timingSafeEqual } from "node:crypto";

export type Role = "admin" | "reader" | "paie";
export type Session = { authenticated: true; exp: number; role: Role; email?: string };

// Each email-bound role has its own pair of env vars; deleting the email revokes its sessions.
const EMAIL_ROLES = {
  reader: ["READ_ONLY_EMAIL", "READ_ONLY_PASSWORD_HASH"],
  paie: ["PAYROLL_EMAIL", "PAYROLL_PASSWORD_HASH"],
} as const;

const roleEmail = (role: keyof typeof EMAIL_ROLES) =>
  Netlify.env.get(EMAIL_ROLES[role][0])?.trim().toLowerCase();

export function verifyReaderPassword(email: string, password: string): boolean {
  return verifyEmailPassword("reader", email, password);
}

export function verifyEmailPassword(role: keyof typeof EMAIL_ROLES, email: string, password: string): boolean {
  const allowedEmail = roleEmail(role);
  const hash = Netlify.env.get(EMAIL_ROLES[role][1]);
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
    const role: Role = payload.role ?? "admin";
    if (role !== "admin" && role !== "reader" && role !== "paie") return null;
    if (role !== "admin" && (!Netlify.env.get(EMAIL_ROLES[role][1]) || payload.email !== roleEmail(role))) return null;
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

// Payroll is restricted to the payroll role (full access) and the read-only accountant (GET).
// The shared team password does not open it.
export function authorizePaie(req: Request): { denied: Response } | { denied: null; session: Session } {
  const session = getSession(req);
  if (!session) return { denied: unauthorized() };
  const lecture = req.method === "GET" || req.method === "HEAD";
  if (session.role === "reader" && !lecture) {
    return { denied: Response.json({ error: "Accès en lecture seule : modification non autorisée" }, { status: 403 }) };
  }
  if (session.role === "admin") {
    return { denied: Response.json({ error: "Accès à la paie réservé" }, { status: 403 }) };
  }
  return { denied: null, session };
}

export const auteur = (session: Session) => session.email ?? session.role;

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Non authentifié" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
