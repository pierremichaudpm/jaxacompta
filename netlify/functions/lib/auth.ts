export function verifyAuth(req: Request): boolean {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  try {
    const payload = JSON.parse(atob(authHeader.slice(7)));
    return payload.authenticated && payload.exp > Date.now();
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
