import type { Context, Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request, _context: Context) => {
  if (!verifyAuth(req)) return unauthorized();
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { image, mimeType } = await req.json();
  const ANTHROPIC_API_KEY =
    Netlify.env.get("ANTHROPIC_API_KEY") || process.env.ANTHROPIC_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return new Response(
      JSON.stringify({ error: "ANTHROPIC_API_KEY non configurée" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: mimeType === "application/pdf" ? "document" : "image",
              source: {
                type: "base64",
                media_type: mimeType,
                data: image,
              },
            },
            {
              type: "text",
              text: `Analyse ce reçu ou cette facture. Extrais les données suivantes en JSON strict :
{
  "date": "YYYY-MM-DD",
  "fournisseur": "nom du commerce/fournisseur",
  "description": "description courte de la transaction",
  "montant_ht": nombre (avant taxes, si visible),
  "tps": nombre (TPS/GST 5%, 0 si non applicable),
  "tvq": nombre (TVQ/QST 9.975%, 0 si non applicable),
  "total_ttc": nombre (montant total payé),
  "mode_paiement": "Mastercard" | "Visa" | "Débit" | "Comptant" | "Autre",
  "numero_recu": "numéro de reçu/facture si visible",
  "confiance": nombre entre 0 et 1 (ton niveau de confiance global)
}

Règles :
- Si le montant HT n'est pas visible, calcule-le à partir du TTC (TTC / 1.14975)
- Si les taxes ne sont pas détaillées, indique tps: 0 et tvq: 0
- Devise : CAD sauf indication contraire
- Retourne UNIQUEMENT le JSON, aucun texte autour`,
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errBody = await response.text();
    console.error(response.status, errBody);
    return new Response(
      JSON.stringify({
        error: `Anthropic API ${response.status}`,
        raw: errBody,
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }

  const result = await response.json();
  const textContent = result.content?.find(
    (c: { type: string }) => c.type === "text",
  );

  try {
    // Strip markdown code fences if present
    let text = (textContent?.text || "").trim();
    text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
    const extracted = JSON.parse(text);
    return new Response(JSON.stringify(extracted), {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({
        error: "Extraction échouée",
        raw: textContent?.text,
      }),
      {
        status: 422,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};

export const config: Config = { path: "/api/ocr" };
