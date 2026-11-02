import { getStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";
import { authorizePaie } from "./lib/auth.ts";
import { erreur } from "./lib/paie.ts";

// Magasin distinct de « receipts » : la lecture exige aussi une session paie ou comptable.
const STORE = "paie-pieces";
const MAX_OCTETS = 10 * 1024 * 1024;

export default async (req: Request, _context: Context) => {
  const auth = authorizePaie(req);
  if (auth.denied) return auth.denied;
  const url = new URL(req.url);

  if (req.method === "POST") {
    const form = await req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return erreur("Fichier requis");
    if (file.size > MAX_OCTETS) return erreur("Fichier trop volumineux (10 Mo max)");
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) return erreur("PDF ou image seulement");
    const key = `${Date.now()}_${crypto.randomUUID()}`;
    await getStore(STORE).set(key, new Blob([await file.arrayBuffer()]), {
      metadata: { contentType: file.type, originalName: file.name },
    });
    return Response.json({ key, nom: file.name }, { status: 201 });
  }

  if (req.method === "GET") {
    const key = url.searchParams.get("key") || "";
    if (!/^\d+_[0-9a-f-]{36}$/.test(key)) return erreur("Clé invalide");
    const res = await getStore(STORE).getWithMetadata(key, { type: "arrayBuffer" });
    if (!res) return erreur("Pièce introuvable", 404);
    return new Response(res.data, {
      headers: {
        "Content-Type": String(res.metadata.contentType || "application/octet-stream"),
        "Cache-Control": "private, no-store",
      },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/paie/pieces" };
