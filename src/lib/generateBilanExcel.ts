import * as XLSX from "xlsx";
import type { Transaction, Projet, CompteBancaire } from "@/types";

interface BilanOptions {
  reportType: "mensuel" | "trimestriel-taxes" | "projet" | "annuel";
  rows?: Transaction[];
  projets?: Projet[];
  comptes?: CompteBancaire[];
  projetId?: string;
  mois?: string;
  trimestre?: string;
  annee?: string;
  compte?: string;
  parCategorie?: { nom: string; type: string; total: number; tps?: number; tvq?: number; montant_ht?: number }[];
  parMois?: { mois: string; revenus: number; depenses: number }[];
  totaux?: Record<string, number>;
}

interface TransactionLayout {
  firstDataRow: number;
  lastDataRow: number;
  depRow: number;
  revRow: number;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function formatDate(d: string) {
  if (!d) return "";
  return d.slice(0, 10);
}

export function generateBilanExcel(opts: BilanOptions) {
  const wb = XLSX.utils.book_new();
  const rows = opts.rows || [];
  const today = new Date().toLocaleDateString("fr-CA");

  const { title, subtitle, filename } = getTitleInfo(opts);

  if (rows.length > 0) {
    const layout = buildTransactionsSheet(wb, rows, title, subtitle, today);
    buildSommaireSheet(wb, layout, title, subtitle);
    buildCategorieSheet(wb, rows, layout);
  } else if (opts.parCategorie || opts.parMois) {
    buildSommaireFromTotaux(wb, opts, title);
    if (opts.parCategorie) {
      buildCategorieSheetFromData(wb, opts.parCategorie);
    }
    if (opts.parMois) {
      buildParMoisSheet(wb, opts.parMois);
    }
  }

  XLSX.writeFile(wb, filename);
}

function getTitleInfo(opts: BilanOptions) {
  const projet = opts.projets?.find((p) => p.id.toString() === opts.projetId);
  const compteBancaire = opts.comptes?.find((c) => c.code === opts.compte);

  switch (opts.reportType) {
    case "projet": {
      const nom = projet?.nom || "Projet";
      const code = projet?.code || "";
      const compteNom = projet?.compte_dedie
        ? opts.comptes?.find((c) => c.code === projet.compte_dedie)?.nom || projet.compte_dedie
        : "";
      return {
        title: `${nom.toUpperCase()} — Bilan des dépenses et revenus`,
        subtitle: `JAXA Production Inc.${compteNom ? ` · ${compteNom}` : ""}${code ? ` · ${code}` : ""}`,
        filename: `${code || "PROJET"}_Bilan_Comptable.xlsx`,
      };
    }
    case "mensuel":
      return {
        title: `Bilan mensuel — ${opts.mois}`,
        subtitle: `JAXA Production Inc.${compteBancaire ? ` · ${compteBancaire.nom}` : " · Tous comptes"}`,
        filename: `Bilan_Comptable_${opts.mois}.xlsx`,
      };
    case "trimestriel-taxes":
      return {
        title: `Rapport de taxes — T${opts.trimestre?.slice(1) || "1"} ${opts.annee}`,
        subtitle: `JAXA Production Inc.`,
        filename: `Bilan_Taxes_T${opts.trimestre?.slice(1) || "1"}_${opts.annee}.xlsx`,
      };
    case "annuel":
      return {
        title: `Bilan annuel — ${opts.annee}`,
        subtitle: `JAXA Production Inc.`,
        filename: `Bilan_Comptable_${opts.annee}.xlsx`,
      };
  }
}

interface Totals {
  revenusHT: number;
  depensesHT: number;
  tpsPercue: number;
  tpsPayee: number;
  tvqPercue: number;
  tvqPayee: number;
  revenusTTC: number;
  depensesTTC: number;
}

function computeTotals(rows: Transaction[]): Totals {
  const t: Totals = {
    revenusHT: 0, depensesHT: 0,
    tpsPercue: 0, tpsPayee: 0,
    tvqPercue: 0, tvqPayee: 0,
    revenusTTC: 0, depensesTTC: 0,
  };

  for (const r of rows) {
    const ht = Number(r.montant_ht) || 0;
    const tps = Number(r.tps) || 0;
    const tvq = Number(r.tvq) || 0;
    const ttc = Number(r.total_ttc) || 0;

    if (r.type === "revenu") {
      t.revenusHT += ht;
      t.tpsPercue += tps;
      t.tvqPercue += tvq;
      t.revenusTTC += ttc;
    } else {
      t.depensesHT += ht;
      t.tpsPayee += tps;
      t.tvqPayee += tvq;
      t.depensesTTC += ttc;
    }
  }

  t.revenusHT = round2(t.revenusHT);
  t.depensesHT = round2(t.depensesHT);
  t.tpsPercue = round2(t.tpsPercue);
  t.tpsPayee = round2(t.tpsPayee);
  t.tvqPercue = round2(t.tvqPercue);
  t.tvqPayee = round2(t.tvqPayee);
  t.revenusTTC = round2(t.revenusTTC);
  t.depensesTTC = round2(t.depensesTTC);

  return t;
}

const COL_WIDTHS = [
  { wch: 12 },  // Date
  { wch: 12 },  // N° pièce
  { wch: 10 },  // Type
  { wch: 55 },  // Description
  { wch: 25 },  // Catégorie
  { wch: 30 },  // Fournisseur / Client
  { wch: 28 },  // Compte bancaire
  { wch: 14 },  // Revenus HT
  { wch: 14 },  // Dépenses HT
  { wch: 12 },  // TPS
  { wch: 14 },  // TVQ
  { wch: 14 },  // Total TTC
  { wch: 18 },  // Mode de paiement
];

function buildTransactionsSheet(
  wb: XLSX.WorkBook,
  rows: Transaction[],
  title: string,
  subtitle: string,
  today: string,
): TransactionLayout {
  const data: (string | number | null | undefined)[][] = [];

  data.push([title]);
  data.push([subtitle]);
  data.push([`Document généré le ${today} — destiné au comptable`]);
  data.push([]);

  data.push([
    "Date", "N° pièce", "Type", "Description", "Catégorie",
    "Fournisseur / Client", "Compte bancaire", "Revenus HT",
    "Dépenses HT", "TPS (5 %)", "TVQ (9,975 %)", "Total TTC",
    "Mode de paiement",
  ]);

  const firstDataRow = 6;

  for (const r of rows) {
    const isRevenu = r.type === "revenu";
    const ht = Number(r.montant_ht) || 0;
    const tps = Number(r.tps) || 0;
    const tvq = Number(r.tvq) || 0;

    data.push([
      formatDate(r.date_transaction),
      r.numero || "",
      r.type,
      r.description || "",
      r.categorie_nom || "",
      r.contact_nom || "",
      r.compte_nom || "",
      isRevenu ? ht : null,
      !isRevenu ? ht : null,
      tps || null,
      tvq || null,
      0,
      r.mode_paiement || "",
    ]);
  }

  const lastDataRow = firstDataRow + rows.length - 1;
  const depRow = lastDataRow + 2;
  const revRow = depRow + 1;
  const netRow = revRow + 2;

  data.push([]);
  data.push([
    "SOUS-TOTAL DÉPENSES", null, null, null, null, null, null,
    null, 0, 0, 0, 0, null,
  ]);
  data.push([
    "SOUS-TOTAL REVENUS", null, null, null, null, null, null,
    0, null, 0, 0, 0, null,
  ]);
  data.push([]);
  data.push([
    "SOLDE NET (Revenus − Dépenses)", null, null, null, null, null, null,
    0, null, null, null, 0, null,
  ]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  for (let i = 0; i < rows.length; i++) {
    const r = firstDataRow + i;
    ws[`L${r}`] = { t: "n", f: `N(H${r})+N(I${r})+N(J${r})+N(K${r})` };
  }

  ws[`I${depRow}`] = { t: "n", f: `SUMIF(C${firstDataRow}:C${lastDataRow},"dépense",I${firstDataRow}:I${lastDataRow})` };
  ws[`J${depRow}`] = { t: "n", f: `SUMIFS(J${firstDataRow}:J${lastDataRow},C${firstDataRow}:C${lastDataRow},"dépense")` };
  ws[`K${depRow}`] = { t: "n", f: `SUMIFS(K${firstDataRow}:K${lastDataRow},C${firstDataRow}:C${lastDataRow},"dépense")` };
  ws[`L${depRow}`] = { t: "n", f: `SUMIFS(L${firstDataRow}:L${lastDataRow},C${firstDataRow}:C${lastDataRow},"dépense")` };

  ws[`H${revRow}`] = { t: "n", f: `SUMIFS(H${firstDataRow}:H${lastDataRow},C${firstDataRow}:C${lastDataRow},"revenu")` };
  ws[`J${revRow}`] = { t: "n", f: `SUMIFS(J${firstDataRow}:J${lastDataRow},C${firstDataRow}:C${lastDataRow},"revenu")` };
  ws[`K${revRow}`] = { t: "n", f: `SUMIFS(K${firstDataRow}:K${lastDataRow},C${firstDataRow}:C${lastDataRow},"revenu")` };
  ws[`L${revRow}`] = { t: "n", f: `SUMIFS(L${firstDataRow}:L${lastDataRow},C${firstDataRow}:C${lastDataRow},"revenu")` };

  ws[`H${netRow}`] = { t: "n", f: `H${revRow}-I${depRow}` };
  ws[`L${netRow}`] = { t: "n", f: `L${revRow}-L${depRow}` };

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 12 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 12 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: 12 } },
  ];

  ws["!cols"] = COL_WIDTHS;

  XLSX.utils.book_append_sheet(wb, ws, "Transactions");

  return { firstDataRow, lastDataRow, depRow, revRow };
}

function buildSommaireSheet(
  wb: XLSX.WorkBook,
  layout: TransactionLayout,
  title: string,
  subtitle: string,
) {
  const projectName = title.split(" — ")[0];

  const parts = subtitle.split(" · ");
  const comptePart = parts.find(p => p.startsWith("Compte")) || "";
  const sommaireSubtitle = comptePart
    ? `Période couverte : voir feuille Transactions · ${comptePart}`
    : "Période couverte : voir feuille Transactions";

  const { depRow, revRow } = layout;

  const data: (string | number | null)[][] = [
    [`Sommaire comptable — ${projectName}`, "", "", ""],
    [sommaireSubtitle, "", "", ""],
    ["", "", "", ""],
    ["", "1. Résultats — Hors taxes", "", ""],
    ["", "Total des revenus (HT)", 0, "Subventions et autres entrées avant taxes"],
    ["", "Total des dépenses (HT)", 0, "Achats et services avant taxes"],
    ["", "SOLDE NET (HT)", 0, "Revenus HT − Dépenses HT"],
    ["", "", "", ""],
    ["", "2. Taxes — Crédits récupérables", "", ""],
    ["", "TPS payée sur dépenses (CTI — crédit fédéral)", 0, "À récupérer auprès de l'ARC"],
    ["", "TVQ payée sur dépenses (RTI — crédit provincial)", 0, "À récupérer auprès de Revenu Québec"],
    ["", "Total des crédits de taxes à récupérer", 0, ""],
    ["", "", "", ""],
    ["", "3. Taxes — Perçues sur revenus", "", ""],
    ["", "TPS perçue sur revenus", 0, "À remettre à l'ARC (le cas échéant)"],
    ["", "TVQ perçue sur revenus", 0, "À remettre à Revenu Québec (le cas échéant)"],
    ["", "", "", ""],
    ["", "4. Position nette de taxes", "", ""],
    ["", "TPS nette (perçue − payée)", 0, ""],
    ["", "TVQ nette (perçue − payée)", 0, ""],
    ["", "", "", ""],
    ["", "5. Mouvements de trésorerie (TTC)", "", ""],
    ["", "Total des entrées (revenus TTC)", 0, ""],
    ["", "Total des sorties (dépenses TTC)", 0, ""],
    ["", "Variation nette de trésorerie", 0, ""],
    ["", "", "", ""],
    ["", "", "", ""],
    ["", "Note : Tous les montants sont reliés par formules à la feuille « Transactions ». Toute modification dans la feuille Transactions met automatiquement à jour ce sommaire.", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["C5"] = { t: "n", f: `Transactions!H${revRow}` };
  ws["C6"] = { t: "n", f: `Transactions!I${depRow}` };
  ws["C7"] = { t: "n", f: `Transactions!H${revRow}-Transactions!I${depRow}` };

  ws["C10"] = { t: "n", f: `Transactions!J${depRow}` };
  ws["C11"] = { t: "n", f: `Transactions!K${depRow}` };
  ws["C12"] = { t: "n", f: `Transactions!J${depRow}+Transactions!K${depRow}` };

  ws["C15"] = { t: "n", f: `Transactions!J${revRow}` };
  ws["C16"] = { t: "n", f: `Transactions!K${revRow}` };

  ws["C19"] = { t: "n", f: `Transactions!J${revRow}-Transactions!J${depRow}` };
  ws["C20"] = { t: "n", f: `Transactions!K${revRow}-Transactions!K${depRow}` };

  ws["D19"] = { t: "str", f: `IF(C19<0,"Négatif = remboursement attendu de l'ARC","À remettre à l'ARC")` };
  ws["D20"] = { t: "str", f: `IF(C20<0,"Négatif = remboursement attendu de Revenu Québec","À remettre à Revenu Québec")` };

  ws["C23"] = { t: "n", f: `Transactions!L${revRow}` };
  ws["C24"] = { t: "n", f: `Transactions!L${depRow}` };
  ws["C25"] = { t: "n", f: `Transactions!L${revRow}-Transactions!L${depRow}` };

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];

  ws["!cols"] = [
    { wch: 4 },
    { wch: 50 },
    { wch: 18 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Sommaire comptable");
}

function buildCategorieSheet(
  wb: XLSX.WorkBook,
  rows: Transaction[],
  layout: TransactionLayout,
) {
  const { firstDataRow, lastDataRow } = layout;

  const categories: { nom: string; type: string }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const catNom = r.categorie_nom || "";
    if (!catNom || seen.has(catNom)) continue;
    seen.add(catNom);
    categories.push({ nom: catNom, type: r.type });
  }

  const data: (string | number | null)[][] = [
    ["Ventilation par catégorie comptable", "", "", "", "", ""],
    ["Pour faciliter les écritures dans le grand livre", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Catégorie", "Type", "Montant HT", "TPS", "TVQ", "Total TTC"],
  ];

  const firstCatRow = 5;

  for (const cat of categories) {
    data.push([cat.nom, cat.type, 0, 0, 0, 0]);
  }

  const lastCatRow = firstCatRow + categories.length - 1;
  const totalRow = lastCatRow + 2;

  data.push(["", "", "", "", "", ""]);
  data.push(["TOTAL", null, 0, 0, 0, 0]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  for (let i = 0; i < categories.length; i++) {
    const cat = categories[i];
    const catRow = firstCatRow + i;
    const htCol = cat.type === "revenu" ? "H" : "I";

    ws[`C${catRow}`] = { t: "n", f: `SUMIFS(Transactions!${htCol}${firstDataRow}:${htCol}${lastDataRow},Transactions!E${firstDataRow}:E${lastDataRow},A${catRow},Transactions!C${firstDataRow}:C${lastDataRow},"${cat.type}")` };
    ws[`D${catRow}`] = { t: "n", f: `SUMIFS(Transactions!J${firstDataRow}:J${lastDataRow},Transactions!E${firstDataRow}:E${lastDataRow},A${catRow},Transactions!C${firstDataRow}:C${lastDataRow},"${cat.type}")` };
    ws[`E${catRow}`] = { t: "n", f: `SUMIFS(Transactions!K${firstDataRow}:K${lastDataRow},Transactions!E${firstDataRow}:E${lastDataRow},A${catRow},Transactions!C${firstDataRow}:C${lastDataRow},"${cat.type}")` };
    ws[`F${catRow}`] = { t: "n", f: `C${catRow}+D${catRow}+E${catRow}` };
  }

  ws[`C${totalRow}`] = { t: "n", f: `SUM(C${firstCatRow}:C${lastCatRow})` };
  ws[`D${totalRow}`] = { t: "n", f: `SUM(D${firstCatRow}:D${lastCatRow})` };
  ws[`E${totalRow}`] = { t: "n", f: `SUM(E${firstCatRow}:E${lastCatRow})` };
  ws[`F${totalRow}`] = { t: "n", f: `SUM(F${firstCatRow}:F${lastCatRow})` };

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];

  ws["!cols"] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Par catégorie");
}

function buildSommaireFromTotaux(
  wb: XLSX.WorkBook,
  opts: BilanOptions,
  title: string,
) {
  const tot = opts.totaux || {};
  const t: Totals = {
    revenusHT: Number(tot.revenus_ht || tot.revenus || 0),
    depensesHT: Number(tot.depenses_ht || tot.depenses || 0),
    tpsPercue: Number(tot.tps_percue || 0),
    tpsPayee: Number(tot.tps_payee || 0),
    tvqPercue: Number(tot.tvq_percue || 0),
    tvqPayee: Number(tot.tvq_payee || 0),
    revenusTTC: Number(tot.revenus_ttc || tot.revenus || 0),
    depensesTTC: Number(tot.depenses_ttc || tot.depenses || 0),
  };

  const projectName = title.split(" — ")[0];
  const totalCredits = round2(t.tpsPayee + t.tvqPayee);
  const tpsNette = round2(t.tpsPercue - t.tpsPayee);
  const tvqNette = round2(t.tvqPercue - t.tvqPayee);
  const variationTresorerie = round2(t.revenusTTC - t.depensesTTC);

  const data: (string | number | null)[][] = [
    [`Sommaire comptable — ${projectName}`, "", "", ""],
    ["Période couverte : voir les données source", "", "", ""],
    ["", "", "", ""],
    ["", "1. Résultats — Hors taxes", "", ""],
    ["", "Total des revenus (HT)", t.revenusHT, "Subventions et autres entrées avant taxes"],
    ["", "Total des dépenses (HT)", t.depensesHT, "Achats et services avant taxes"],
    ["", "SOLDE NET (HT)", round2(t.revenusHT - t.depensesHT), "Revenus HT − Dépenses HT"],
    ["", "", "", ""],
    ["", "2. Taxes — Crédits récupérables", "", ""],
    ["", "TPS payée sur dépenses (CTI — crédit fédéral)", t.tpsPayee, "À récupérer auprès de l'ARC"],
    ["", "TVQ payée sur dépenses (RTI — crédit provincial)", t.tvqPayee, "À récupérer auprès de Revenu Québec"],
    ["", "Total des crédits de taxes à récupérer", totalCredits, ""],
    ["", "", "", ""],
    ["", "3. Taxes — Perçues sur revenus", "", ""],
    ["", "TPS perçue sur revenus", t.tpsPercue, "À remettre à l'ARC (le cas échéant)"],
    ["", "TVQ perçue sur revenus", t.tvqPercue, "À remettre à Revenu Québec (le cas échéant)"],
    ["", "", "", ""],
    ["", "4. Position nette de taxes", "", ""],
    ["", "TPS nette (perçue − payée)", tpsNette, tpsNette < 0 ? "Négatif = remboursement attendu de l'ARC" : "À remettre à l'ARC"],
    ["", "TVQ nette (perçue − payée)", tvqNette, tvqNette < 0 ? "Négatif = remboursement attendu de Revenu Québec" : "À remettre à Revenu Québec"],
    ["", "", "", ""],
    ["", "5. Mouvements de trésorerie (TTC)", "", ""],
    ["", "Total des entrées (revenus TTC)", t.revenusTTC, ""],
    ["", "Total des sorties (dépenses TTC)", t.depensesTTC, ""],
    ["", "Variation nette de trésorerie", variationTresorerie, ""],
    ["", "", "", ""],
    ["", "", "", ""],
    ["", "Note : Tous les montants sont calculés à partir des transactions enregistrées.", "", ""],
  ];

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 3 } },
  ];

  ws["!cols"] = [
    { wch: 4 },
    { wch: 50 },
    { wch: 18 },
    { wch: 50 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Sommaire comptable");
}

function buildCategorieSheetFromData(
  wb: XLSX.WorkBook,
  parCategorie: { nom: string; type: string; total: number; tps?: number; tvq?: number; montant_ht?: number }[],
) {
  const data: (string | number | null)[][] = [
    ["Ventilation par catégorie comptable", "", "", "", "", ""],
    ["Pour faciliter les écritures dans le grand livre", "", "", "", "", ""],
    ["", "", "", "", "", ""],
    ["Catégorie", "Type", "Montant HT", "TPS", "TVQ", "Total TTC"],
  ];

  let totalHT = 0, totalTPS = 0, totalTVQ = 0, totalTTC = 0;

  for (const cat of parCategorie) {
    const ht = Number(cat.montant_ht || 0);
    const tps = Number(cat.tps || 0);
    const tvq = Number(cat.tvq || 0);
    const ttc = Number(cat.total || 0);
    data.push([cat.nom, cat.type, ht, tps, tvq, ttc]);
    totalHT += ht;
    totalTPS += tps;
    totalTVQ += tvq;
    totalTTC += ttc;
  }

  data.push(["", "", "", "", "", ""]);
  data.push(["TOTAL", "", round2(totalHT), round2(totalTPS), round2(totalTVQ), round2(totalTTC)]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
  ];

  ws["!cols"] = [
    { wch: 30 },
    { wch: 12 },
    { wch: 14 },
    { wch: 12 },
    { wch: 14 },
    { wch: 14 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Par catégorie");
}

function buildParMoisSheet(
  wb: XLSX.WorkBook,
  parMois: { mois: string; revenus: number; depenses: number }[],
) {
  const data: (string | number | null)[][] = [
    ["Évolution mensuelle", "", "", ""],
    ["", "", "", ""],
    ["Mois", "Revenus", "Dépenses", "Solde"],
  ];

  let totalRev = 0, totalDep = 0;

  for (const m of parMois) {
    const rev = Number(m.revenus) || 0;
    const dep = Number(m.depenses) || 0;
    data.push([m.mois, rev, dep, round2(rev - dep)]);
    totalRev += rev;
    totalDep += dep;
  }

  data.push(["", "", "", ""]);
  data.push(["TOTAL", round2(totalRev), round2(totalDep), round2(totalRev - totalDep)]);

  const ws = XLSX.utils.aoa_to_sheet(data);

  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 3 } },
  ];

  ws["!cols"] = [
    { wch: 14 },
    { wch: 16 },
    { wch: 16 },
    { wch: 16 },
  ];

  XLSX.utils.book_append_sheet(wb, ws, "Par mois");
}
