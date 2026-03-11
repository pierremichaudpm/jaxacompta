import { getStore } from "@netlify/blobs";
import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  const url = new URL(req.url);

  // Allow unauthenticated GET (keys are random/unguessable)
  if (req.method !== "GET") {
    if (!verifyAuth(req)) return unauthorized();
  }

  if (req.method === "POST") {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(JSON.stringify({ error: "Fichier requis" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("receipts");
    const ext = file.name.split(".").pop() || "bin";
    const key = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const buffer = await file.arrayBuffer();
    await store.set(key, new Blob([buffer]), {
      metadata: { contentType: file.type, originalName: file.name },
    });

    return new Response(
      JSON.stringify({ url: `/.netlify/blobs/${key}`, key }),
      {
        status: 201,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  if (req.method === "GET") {
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "Clé requise" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("receipts");
    const result = await store.getWithMetadata(key, { type: "arrayBuffer" });
    if (!result) {
      return new Response("Not found", { status: 404 });
    }

    const contentType =
      (result.metadata as Record<string, string>)?.contentType ||
      "application/octet-stream";
    return new Response(result.data as ArrayBuffer, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=31536000",
      },
    });
  }

  if (req.method === "DELETE") {
    const key = url.searchParams.get("key");
    if (!key) {
      return new Response(JSON.stringify({ error: "Clé requise" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const store = getStore("receipts");
    await store.delete(key);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};

export const config: Config = { path: "/api/upload" };
