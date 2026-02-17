import { neon } from "@netlify/neon";
import type { Config } from "@netlify/functions";
import { verifyAuth, unauthorized } from "./lib/auth.ts";

export default async (req: Request) => {
  if (!verifyAuth(req)) return unauthorized();
  const sql = neon();
  const url = new URL(req.url);
  const type = url.searchParams.get("type") || "mensuel";
  const mois = url.searchParams.get("mois");
  const compte = url.searchParams.get("compte");
  const annee = url.searchParams.get("annee") || new Date().getFullYear().toString();

  if (type === "mensuel") {
    const rows = await sql(`
      SELECT t.*, c.nom as categorie_nom, p.code as projet_code,
             co.nom as contact_nom, cb.nom as compte_nom
      FROM transactions t
      LEFT JOIN categories c ON t.categorie_id = c.id
      LEFT JOIN projets p ON t.projet_id = p.id
      LEFT JOIN contacts co ON t.contact_id = co.id
      LEFT JOIN comptes_bancaires cb ON t.compte_id = cb.id
      WHERE to_char(t.date_transaction, 'YYYY-MM') = $1
      ${compte ? 'AND cb.code = $2' : ''}
      ORDER BY t.date_transaction
    `, compte ? [mois, compte] : [mois]);

    const [totaux] = await sql(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN total_ttc ELSE 0 END), 0) as revenus,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN total_ttc ELSE 0 END), 0) as depenses,
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN tps ELSE 0 END), 0) as tps_percue,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN tps ELSE 0 END), 0) as tps_payee,
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN tvq ELSE 0 END), 0) as tvq_percue,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN tvq ELSE 0 END), 0) as tvq_payee
      FROM transactions
      WHERE to_char(date_transaction, 'YYYY-MM') = $1
    `, [mois]);

    return new Response(JSON.stringify({ rows, totaux }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (type === "trimestriel-taxes") {
    const trimestre = url.searchParams.get("trimestre") || "Q1";
    const trimestreMap: Record<string, [string, string]> = {
      Q1: [`${annee}-01-01`, `${annee}-03-31`],
      Q2: [`${annee}-04-01`, `${annee}-06-30`],
      Q3: [`${annee}-07-01`, `${annee}-09-30`],
      Q4: [`${annee}-10-01`, `${annee}-12-31`],
    };
    const [debut, fin] = trimestreMap[trimestre] || trimestreMap.Q1;

    const [totaux] = await sql(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN tps ELSE 0 END), 0) as tps_percue,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN tps ELSE 0 END), 0) as tps_payee,
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN tvq ELSE 0 END), 0) as tvq_percue,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN tvq ELSE 0 END), 0) as tvq_payee,
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN total_ttc ELSE 0 END), 0) as revenus,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN total_ttc ELSE 0 END), 0) as depenses
      FROM transactions
      WHERE date_transaction BETWEEN $1 AND $2
    `, [debut, fin]);

    const parCategorie = await sql(`
      SELECT c.nom, c.type,
        COALESCE(SUM(t.total_ttc), 0) as total,
        COALESCE(SUM(t.tps), 0) as tps,
        COALESCE(SUM(t.tvq), 0) as tvq
      FROM transactions t
      JOIN categories c ON t.categorie_id = c.id
      WHERE t.date_transaction BETWEEN $1 AND $2
      GROUP BY c.id, c.nom, c.type
      ORDER BY total DESC
    `, [debut, fin]);

    return new Response(JSON.stringify({ totaux, parCategorie, periode: { debut, fin } }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (type === "projet") {
    const projetId = url.searchParams.get("projet_id");
    const rows = await sql(`
      SELECT t.*, c.nom as categorie_nom, co.nom as contact_nom, cb.nom as compte_nom
      FROM transactions t
      LEFT JOIN categories c ON t.categorie_id = c.id
      LEFT JOIN contacts co ON t.contact_id = co.id
      LEFT JOIN comptes_bancaires cb ON t.compte_id = cb.id
      WHERE t.projet_id = $1
      ORDER BY t.date_transaction
    `, [Number(projetId)]);

    const [totaux] = await sql(`
      SELECT
        COALESCE(SUM(CASE WHEN type = 'revenu' THEN total_ttc ELSE 0 END), 0) as revenus,
        COALESCE(SUM(CASE WHEN type = 'dépense' THEN total_ttc ELSE 0 END), 0) as depenses
      FROM transactions WHERE projet_id = $1
    `, [Number(projetId)]);

    return new Response(JSON.stringify({ rows, totaux }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  if (type === "annuel") {
    const parMois = await sql(`
      SELECT
        to_char(date_transaction, 'YYYY-MM') as mois,
        SUM(CASE WHEN type = 'revenu' THEN total_ttc ELSE 0 END) as revenus,
        SUM(CASE WHEN type = 'dépense' THEN total_ttc ELSE 0 END) as depenses
      FROM transactions
      WHERE EXTRACT(YEAR FROM date_transaction) = $1
      GROUP BY to_char(date_transaction, 'YYYY-MM')
      ORDER BY mois
    `, [Number(annee)]);

    const parCategorie = await sql(`
      SELECT c.nom, c.type,
        COALESCE(SUM(t.total_ttc), 0) as total
      FROM transactions t
      JOIN categories c ON t.categorie_id = c.id
      WHERE EXTRACT(YEAR FROM t.date_transaction) = $1
      GROUP BY c.id, c.nom, c.type
      ORDER BY total DESC
    `, [Number(annee)]);

    return new Response(JSON.stringify({ parMois, parCategorie, annee }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Type de rapport inconnu" }), {
    status: 400,
    headers: { "Content-Type": "application/json" },
  });
};

export const config: Config = { path: "/api/rapports" };
