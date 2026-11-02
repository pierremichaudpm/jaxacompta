import { neon } from "@netlify/neon";
import type { Context, Config } from "@netlify/functions";
import { authorizePaie } from "./lib/auth.ts";
import { dateIso, montant } from "./lib/paie.ts";

// Lecture seule : écritures de paie de l'année et journal des modifications
export default async (req: Request, _context: Context) => {
  const auth = authorizePaie(req);
  if (auth.denied) return auth.denied;
  if (req.method !== "GET") return new Response("Method not allowed", { status: 405 });
  const sql = neon();
  const url = new URL(req.url);

  if (url.searchParams.get("modifications")) {
    return Response.json(await sql`
      SELECT * FROM journal_modifications ORDER BY created_at DESC, id DESC LIMIT 300
    `);
  }

  const annee = Number(url.searchParams.get("annee")) || new Date().getFullYear();
  const ecritures = await sql`
    SELECT e.*, COALESCE(json_agg(json_build_object(
      'compte', l.compte_numero, 'nom', g.nom, 'debit', l.debit, 'credit', l.credit, 'banque', cb.nom
    ) ORDER BY l.id), '[]') AS lignes
    FROM ecritures e
    JOIN ecriture_lignes l ON l.ecriture_id = e.id
    JOIN comptes_gl g ON g.numero = l.compte_numero
    LEFT JOIN comptes_bancaires cb ON cb.id = l.compte_bancaire_id
    WHERE e.date_ecriture BETWEEN ${annee + "-01-01"} AND ${annee + "-12-31"}
    GROUP BY e.id
    ORDER BY e.date_ecriture DESC, e.id DESC
  `;
  return Response.json(ecritures.map((e) => ({
    ...e,
    date_ecriture: dateIso(e.date_ecriture),
    lignes: e.lignes.map((l: Record<string, unknown>) => ({ ...l, debit: montant(l.debit), credit: montant(l.credit) })),
  })));
};

export const config: Config = { path: "/api/paie/journal" };
