import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret(): string {
  const secret = Netlify.env.get("APP_SECRET");
  if (!secret) throw new Error("APP_SECRET non configuré");
  return secret;
}

function sign(payloadB64: string): string {
  return createHmac("sha256", getSecret()).update(payloadB64).digest("base64url");
}

export function issueToken(ttlMs = 7 * 24 * 60 * 60 * 1000): string {
  const payloadB64 = btoa(JSON.stringify({
    authenticated: true,
    exp: Date.now() + ttlMs,
  }));
  return `${payloadB64}.${sign(payloadB64)}`;
}

export function verifyAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    const [payloadB64, sig] = authHeader.slice(7).split(".");
    if (!payloadB64 || !sig) return false;
    const expected = Buffer.from(sign(payloadB64));
    const actual = Buffer.from(sig);
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      return false;
    }
    const payload = JSON.parse(atob(payloadB64));
    return payload.authenticated === true && payload.exp > Date.now();
  } catch {
    return false;
  }
}

export function unauthorized() {
  return new Response(JSON.stringify({ error: "Non authentifié" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
