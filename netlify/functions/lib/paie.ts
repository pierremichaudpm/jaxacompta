import type { NeonQueryFunction } from "@neondatabase/serverless";
import type { LigneEcriture, PaieParametres } from "../../../src/lib/paieCalcul.ts";

type Sql = NeonQueryFunction<false, false>;

export const erreur = (error: string, status = 400) => Response.json({ error }, { status });

export const montant = (v: unknown) => Math.round(Number(v || 0) * 100) / 100;

const MONTANTS_PAIE = [
  "brut", "ae", "rqap", "rrq", "impot_federal", "impot_provincial", "fss", "net", "rqap_employeur",
  "rrq_employeur", "ae_employeur", "cnt", "cnesst", "vacances", "das_federal", "das_provincial",
] as const;

// Le driver renvoie les DATE en objets Date à minuit local : on les ramène en AAAA-MM-JJ.
export function dateIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) {
    const p = (n: number) => String(n).padStart(2, "0");
    return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
  }
  return String(v).slice(0, 10);
}

export function avecDates<T extends Record<string, unknown>>(row: T, cles: string[]): T {
  const out: Record<string, unknown> = { ...row };
  for (const k of cles) if (k in out) out[k] = dateIso(out[k]);
  return out as T;
}

// Le driver renvoie les DECIMAL en texte : on les convertit avant tout calcul.
export function paieNumerique<T extends Record<string, unknown>>(row: T) {
  const out: Record<string, unknown> = avecDates(row, ["date_paie", "periode_debut", "periode_fin"]);
  for (const k of MONTANTS_PAIE) out[k] = montant(row[k]);
  return out as T & Record<(typeof MONTANTS_PAIE)[number], number> & { date_paie: string };
}

export async function chargerParametres(sql: Sql, annee: number): Promise<PaieParametres | null> {
  const [p] = await sql`SELECT * FROM paie_parametres WHERE annee = ${annee}`;
  if (!p) return null;
  return {
    rqap_taux_employeur: Number(p.rqap_taux_employeur),
    rqap_max_assurable: Number(p.rqap_max_assurable),
    ae_ratio_employeur: Number(p.ae_ratio_employeur),
    cnt_taux: Number(p.cnt_taux),
    cnt_max_assurable: Number(p.cnt_max_assurable),
    cnesst_taux: Number(p.cnesst_taux),
    cnesst_max_assurable: p.cnesst_max_assurable == null ? null : Number(p.cnesst_max_assurable),
    fss_taux: Number(p.fss_taux),
  };
}

// Ids réservés à l'avance : le driver HTTP n'exécute que des transactions non interactives.
export async function reserverId(sql: Sql, table: "ecritures" | "transactions"): Promise<number> {
  const [r] = await sql.query(`SELECT nextval(pg_get_serial_sequence('${table}', 'id')) AS id`);
  return Number(r.id);
}

export function journaliser(
  sql: Sql, table: string, id: number | null, action: string, utilisateur: string,
  avant: unknown, apres: unknown,
) {
  return sql`
    INSERT INTO journal_modifications (table_nom, enregistrement_id, action, utilisateur, avant, apres)
    VALUES (${table}, ${id}, ${action}, ${utilisateur},
            ${avant == null ? null : JSON.stringify(avant)}::jsonb,
            ${apres == null ? null : JSON.stringify(apres)}::jsonb)
  `;
}

export function insererEcriture(
  sql: Sql,
  e: { id: number; date: string; libelle: string; source: string; sourceId: number | null;
       annuleId?: number | null; auteur: string; compteBancaireId: number | null },
  lignes: LigneEcriture[],
) {
  return [
    sql`
      INSERT INTO ecritures (id, date_ecriture, libelle, source, source_id, annule_ecriture_id, created_by)
      VALUES (${e.id}, ${e.date}, ${e.libelle}, ${e.source}, ${e.sourceId}, ${e.annuleId ?? null}, ${e.auteur})
    `,
    ...lignes.map((l) => sql`
      INSERT INTO ecriture_lignes (ecriture_id, compte_numero, compte_bancaire_id, debit, credit)
      VALUES (${e.id}, ${l.compte}, ${l.banque ? e.compteBancaireId : null}, ${l.debit}, ${l.credit})
    `),
  ];
}

export async function lignesEcriture(sql: Sql, ecritureId: number): Promise<LigneEcriture[]> {
  const rows = await sql`
    SELECT compte_numero, compte_bancaire_id, debit, credit FROM ecriture_lignes
    WHERE ecriture_id = ${ecritureId} ORDER BY id
  `;
  return rows.map((r) => ({
    compte: r.compte_numero,
    debit: montant(r.debit),
    credit: montant(r.credit),
    ...(r.compte_bancaire_id ? { banque: true } : {}),
  }));
}

export async function categorieSalaires(sql: Sql): Promise<number | null> {
  const [c] = await sql`SELECT id FROM categories WHERE nom = 'Salaires et charges sociales'`;
  return c?.id ?? null;
}

// Sortie de banque dans la comptabilité de caisse (soldes, rapprochement, rapports)
export function insererSortieBanque(
  sql: Sql,
  t: { id: number; date: string; description: string; compteId: number; montant: number; categorieId: number | null },
) {
  return sql`
    INSERT INTO transactions
      (id, date_transaction, type, description, categorie_id, compte_id, mode_paiement,
       montant_ht, tps, tvq, total_ttc, taxable)
    VALUES (${t.id}, ${t.date}, 'dépense', ${t.description}, ${t.categorieId}, ${t.compteId}, 'Virement',
            ${t.montant}, 0, 0, ${t.montant}, false)
  `;
}
