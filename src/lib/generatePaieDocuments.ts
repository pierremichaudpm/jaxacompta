import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { COMPANY_INFO } from "./companyInfo";
import { NOMS_COMPTES } from "./paieCalcul";
import type { Employe, MoisDAS, Paie } from "@/types";

// Exports de paie. Les classeurs ne contiennent que des valeurs (aucune formule, aucun style
// propre à Excel) pour s'ouvrir à l'identique dans Google Sheets.

const fmtNum = (n: number) =>
  new Intl.NumberFormat("fr-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const r2 = (n: number) => Math.round(n * 100) / 100;
export const MOIS = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const nomMois = (iso: string) => `${MOIS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

type Palier = "federal" | "provincial";
type OptionsRequisition = { demande_par?: string; approuve_par?: string };

// Lignes du gabarit « Réquisition de paiement » (numéros de compte du plan comptable)
const LIGNES: Record<Palier, string[]> = {
  federal: ["2180", "2190"],
  provincial: ["2151", "2200", "2205", "2210", "2212"],
};
const LIBELLES: Record<string, string> = {
  "2151": "CNESST",
  "2180": "Assurance-emploi",
  "2190": "Impôt fédéral",
  "2200": "RRQ",
  "2205": "Impôt du Québec",
  "2210": "FSS",
  "2212": "RQAP",
};

function contenuRequisition(m: MoisDAS, palier: Palier, opts: OptionsRequisition) {
  const p = m[palier];
  const dernierePaie = m.dates_paie[m.dates_paie.length - 1] ?? m.mois;
  return {
    entete: [
      ["Compagnie", COMPANY_INFO.nom],
      ["Date de la paie", m.dates_paie.length > 1 ? `${m.dates_paie.join(", ")}` : dernierePaie],
      ["Mois", nomMois(m.mois)],
      ["Montant", p.total],
      ["Payable à", p.payable_a],
      ["Doit être payé le", m.date_limite],
    ] as [string, string | number][],
    titre: palier === "federal" ? "DAS FÉDÉRAL" : "DAS PROVINCIAL",
    lignes: LIGNES[palier].map((c) => [c, LIBELLES[c], Number(p.detail[c] ?? 0)] as [string, string, number]),
    total: p.total,
    masse: m.masse_salariale,
    nb: m.nb_employes,
    demande: opts.demande_par || "",
    approuve: opts.approuve_par || "",
  };
}

export function requisitionPDF(m: MoisDAS, palier: Palier, opts: OptionsRequisition = {}) {
  const c = contenuRequisition(m, palier, opts);
  const doc = new jsPDF();
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("RÉQUISITION DE PAIEMENT", 105, 20, { align: "center" });
  doc.setFontSize(11);
  doc.text(c.titre, 105, 28, { align: "center" });

  autoTable(doc, {
    startY: 36,
    body: c.entete.map(([k, v]) => [k, typeof v === "number" ? `${fmtNum(v)} $` : v]),
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 1.5 },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 50 } },
  });

  autoTable(doc, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    startY: (doc as any).lastAutoTable.finalY + 8,
    head: [["Compte", "Description", "Montant"]],
    body: [
      ...c.lignes.map(([compte, lib, montant]) => [
        compte,
        compte === "2151" && !montant ? `${lib} (aucune cotisation ce mois)` : lib,
        fmtNum(montant),
      ]),
      ["", "TOTAL", fmtNum(c.total)],
    ],
    theme: "grid",
    headStyles: { fillColor: [30, 41, 59] },
    styles: { fontSize: 10 },
    columnStyles: { 0: { cellWidth: 25 }, 2: { halign: "right", cellWidth: 40 } },
    didParseCell: (d) => {
      if (d.section === "body" && d.row.index === c.lignes.length) d.cell.styles.fontStyle = "bold";
    },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let y = (doc as any).lastAutoTable.finalY + 10;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text(`Masse salariale du mois : ${fmtNum(c.masse)} $`, 14, y);
  doc.text(`Nombre d'employés : ${c.nb}`, 14, (y += 6));
  y += 20;
  doc.text(`Demandé par : ${c.demande}`, 14, y);
  doc.text(`Approuvé par : ${c.approuve}`, 110, y);
  doc.line(40, y + 1, 100, y + 1);
  doc.line(137, y + 1, 196, y + 1);
  doc.setFontSize(8);
  doc.text("Réservé à la comptabilité", 14, y + 16);

  doc.save(`Requisition_DAS_${palier === "federal" ? "federal" : "provincial"}_${m.mois.slice(0, 7)}.pdf`);
}

function feuilleRequisition(m: MoisDAS, palier: Palier, opts: OptionsRequisition) {
  const c = contenuRequisition(m, palier, opts);
  const aoa: (string | number)[][] = [
    ["RÉQUISITION DE PAIEMENT"],
    [c.titre],
    [],
    ...c.entete,
    [],
    ["Compte", "Description", "Montant"],
    ...c.lignes,
    ["", "TOTAL", c.total],
    [],
    ["Masse salariale", "", c.masse],
    ["Nombre d'employés", "", c.nb],
    [],
    ["Demandé par", c.demande],
    ["Approuvé par", c.approuve],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = [{ wch: 22 }, { wch: 34 }, { wch: 14 }];
  return ws;
}

export function requisitionExcel(m: MoisDAS, opts: OptionsRequisition = {}) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, feuilleRequisition(m, "federal", opts), "Fédéral");
  XLSX.utils.book_append_sheet(wb, feuilleRequisition(m, "provincial", opts), "Provincial");
  XLSX.writeFile(wb, `Requisitions_DAS_${m.mois.slice(0, 7)}.xlsx`);
}

// --- Sommaire annuel ---

export const COLONNES_SOMMAIRE: { cle: keyof Paie; titre: string }[] = [
  { cle: "brut", titre: "Brut" },
  { cle: "ae", titre: "A-E" },
  { cle: "rqap", titre: "RQAP" },
  { cle: "rrq", titre: "RRQ" },
  { cle: "impot_federal", titre: "Impôt fédéral" },
  { cle: "impot_provincial", titre: "Impôt provincial" },
  { cle: "net", titre: "Salaire net" },
  { cle: "rqap_employeur", titre: "RQAP employeur" },
  { cle: "rrq_employeur", titre: "RRQ employeur" },
  { cle: "ae_employeur", titre: "A-E employeur" },
  { cle: "fss", titre: "FSS" },
  { cle: "cnt", titre: "CNT" },
  { cle: "cnesst", titre: "CNESST" },
  { cle: "vacances", titre: "Vacances" },
  { cle: "das_federal", titre: "DAS fédéral" },
  { cle: "das_provincial", titre: "DAS provincial" },
];

export function totauxMensuels(paies: Paie[]) {
  const mois = MOIS.map(() => Object.fromEntries(COLONNES_SOMMAIRE.map((c) => [c.cle, 0])) as Record<string, number>);
  const total = Object.fromEntries(COLONNES_SOMMAIRE.map((c) => [c.cle, 0])) as Record<string, number>;
  for (const p of paies) {
    const i = Number(p.date_paie.slice(5, 7)) - 1;
    for (const { cle } of COLONNES_SOMMAIRE) {
      mois[i][cle] = r2(mois[i][cle] + Number(p[cle]));
      total[cle] = r2(total[cle] + Number(p[cle]));
    }
  }
  return { mois, total };
}

// Cases T4 / RL-1 (à valider par le comptable). Les vacances provisionnées ne sont pas
// des revenus versés : elles s'ajouteront quand elles seront payées.
export function recapitulatifAnnuel(paies: Paie[], employes: Employe[]) {
  return employes
    .map((e) => {
      const ps = paies.filter((p) => p.employe_id === e.id);
      const s = (k: keyof Paie) => r2(ps.reduce((t, p) => t + Number(p[k]), 0));
      const brut = s("brut");
      return {
        employe: e,
        nb_paies: ps.length,
        cases: [
          { t4: "14", rl1: "A", libelle: "Revenus d'emploi", montant: brut },
          { t4: "17", rl1: "B", libelle: "Cotisations au RRQ", montant: s("rrq") },
          { t4: "26", rl1: "G", libelle: "Gains / salaire admissible au RRQ", montant: brut },
          { t4: "18", rl1: "C", libelle: "Cotisations à l'assurance-emploi", montant: s("ae") },
          { t4: "24", rl1: "", libelle: "Gains assurables d'A-E", montant: e.assujetti_ae ? brut : 0 },
          { t4: "55", rl1: "H", libelle: "Cotisations au RQAP", montant: s("rqap") },
          { t4: "56", rl1: "I", libelle: "Salaire admissible au RQAP", montant: brut },
          { t4: "22", rl1: "", libelle: "Impôt fédéral retenu", montant: s("impot_federal") },
          { t4: "", rl1: "E", libelle: "Impôt du Québec retenu", montant: s("impot_provincial") },
        ],
      };
    })
    .filter((r) => r.nb_paies > 0);
}

export function sommaireAnnuelExcel(annee: number, paies: Paie[], employes: Employe[], das: MoisDAS[]) {
  const wb = XLSX.utils.book_new();
  const titres = COLONNES_SOMMAIRE.map((c) => c.titre);
  const { mois, total } = totauxMensuels(paies);

  const sommaire = XLSX.utils.aoa_to_sheet([
    [COMPANY_INFO.nom],
    [`Sommaire des paies ${annee}`],
    [],
    ["Mois", ...titres],
    ...mois.map((m, i) => [MOIS[i], ...COLONNES_SOMMAIRE.map((c) => m[c.cle])]),
    ["TOTAL", ...COLONNES_SOMMAIRE.map((c) => total[c.cle])],
  ]);
  sommaire["!cols"] = [{ wch: 12 }, ...titres.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, sommaire, "Sommaire mensuel");

  const tri = [...paies].sort((a, b) => a.date_paie.localeCompare(b.date_paie));
  const detail = XLSX.utils.aoa_to_sheet([
    ["Date", "Employé", "Statut", ...titres],
    ...tri.map((p) => [p.date_paie, `${p.prenom} ${p.nom}`, p.statut, ...COLONNES_SOMMAIRE.map((c) => Number(p[c.cle]))]),
  ]);
  detail["!cols"] = [{ wch: 12 }, { wch: 22 }, { wch: 14 }, ...titres.map(() => ({ wch: 14 }))];
  XLSX.utils.book_append_sheet(wb, detail, "Paies");

  const remises = XLSX.utils.aoa_to_sheet([
    ["Mois", "Date limite", "DAS fédéral", "Payée le", "DAS provincial", "Payée le", "Masse salariale", "Employés"],
    ...das.map((m) => [
      nomMois(m.mois), m.date_limite,
      m.federal.total, m.federal.remise?.date_paiement ?? "",
      m.provincial.total, m.provincial.remise?.date_paiement ?? "",
      m.masse_salariale, m.nb_employes,
    ]),
  ]);
  remises["!cols"] = [{ wch: 16 }, { wch: 12 }, { wch: 13 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 15 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, remises, "Remises DAS");

  const recap = recapitulatifAnnuel(paies, employes);
  const t4 = XLSX.utils.aoa_to_sheet([
    [`Récapitulatif ${annee} pour T4 et RL-1 (à valider par le comptable)`],
    [],
    ...recap.flatMap((r) => [
      [`${r.employe.prenom} ${r.employe.nom}`, r.employe.nas_derniers3 ? `NAS ***-***-${r.employe.nas_derniers3}` : ""],
      ["Case T4", "Case RL-1", "Description", "Montant"],
      ...r.cases.map((c) => [c.t4, c.rl1, c.libelle, c.montant]),
      [],
    ]),
  ]);
  t4["!cols"] = [{ wch: 26 }, { wch: 12 }, { wch: 38 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, t4, "T4 - RL-1");

  XLSX.writeFile(wb, `Sommaire_paies_${annee}.xlsx`);
}

export const nomCompte = (numero: string) => `${numero} – ${NOMS_COMPTES[numero] ?? ""}`;
