// Calculs de paie partagés entre l'interface (aperçu) et le serveur (qui fait foi).
// Les retenues de l'employé viennent d'un calculateur externe (Impot.net, WinRAS, CDRP) :
// on calcule seulement ce qui en découle. Tout est fait en cents entiers, arrondi à chaque ligne.

export type PaieSaisie = {
  brut: number;
  ae: number;
  rqap: number;
  rrq: number;
  impot_federal: number;
  impot_provincial: number;
  fss: number;
};

export type PaieParametres = {
  rqap_taux_employeur: number;
  rqap_max_assurable: number;
  ae_ratio_employeur: number;
  cnt_taux: number;
  cnt_max_assurable: number;
  cnesst_taux: number; // $ par 100 $ de salaire
  cnesst_max_assurable: number | null;
  fss_taux: number;
};

export type PaieContexte = {
  cumul_brut_avant: number; // salaire déjà versé dans l'année, pour les plafonds
  assujetti_cnesst: boolean;
  taux_vacances: number;
};

export type PaieCalculee = {
  net: number;
  rqap_employeur: number;
  rrq_employeur: number;
  ae_employeur: number;
  cnt: number;
  cnesst: number;
  vacances: number;
  das_federal: number;
  das_provincial: number;
};

export type LigneEcriture = {
  compte: string;
  debit: number;
  credit: number;
  banque?: boolean; // ligne 1010 : rattachée au compte bancaire choisi
};

export const TOLERANCE_REFERENCE = 0.02;

// Demi-cent arrondi vers le haut, sans les erreurs de représentation (9,576 → 958 ; 0,5 → 1).
const arrondi = (v: number) => Math.round(Math.round(v * 1e6) / 1e6);
export const enCents = (v: number | string | null | undefined) => arrondi(Number(v || 0) * 100);
const enDollars = (c: number) => c / 100;

const assurable = (brutC: number, maxDollars: number | null, cumulC: number) =>
  maxDollars == null ? brutC : Math.max(0, Math.min(brutC, enCents(maxDollars) - cumulC));

export function calculerPaie(s: PaieSaisie, p: PaieParametres, ctx: PaieContexte): PaieCalculee {
  const brut = enCents(s.brut);
  const ae = enCents(s.ae);
  const rqap = enCents(s.rqap);
  const rrq = enCents(s.rrq);
  const fed = enCents(s.impot_federal);
  const prov = enCents(s.impot_provincial);
  const fss = enCents(s.fss);
  const cumul = enCents(ctx.cumul_brut_avant);

  // RQAP employeur : taux employeur × revenu assurable (méthode de Revenu Québec), nul si l'employé ne cotise pas
  const rqapEr = rqap === 0 ? 0 : arrondi(assurable(brut, p.rqap_max_assurable, cumul) * p.rqap_taux_employeur);
  const aeEr = arrondi(ae * p.ae_ratio_employeur);
  const rrqEr = rrq;
  const cnt = arrondi(assurable(brut, p.cnt_max_assurable, cumul) * p.cnt_taux);
  const cnesst = ctx.assujetti_cnesst
    ? arrondi((assurable(brut, p.cnesst_max_assurable, cumul) * p.cnesst_taux) / 100)
    : 0;
  const vacances = arrondi(brut * ctx.taux_vacances);

  return {
    net: enDollars(brut - ae - rqap - rrq - fed - prov),
    rqap_employeur: enDollars(rqapEr),
    rrq_employeur: enDollars(rrqEr),
    ae_employeur: enDollars(aeEr),
    cnt: enDollars(cnt),
    cnesst: enDollars(cnesst),
    vacances: enDollars(vacances),
    das_federal: enDollars(fed + ae + aeEr),
    das_provincial: enDollars(prov + rrq + rrqEr + rqap + rqapEr + fss + cnesst),
  };
}

// Pré-remplissage de la cotisation FSS (le montant du calculateur reste saisissable)
export const fssSuggeree = (brut: number, p: Pick<PaieParametres, "fss_taux">) =>
  enDollars(arrondi(enCents(brut) * p.fss_taux));

export function ecartReference(net: number, netReference: number | null | undefined) {
  if (netReference == null || Number.isNaN(Number(netReference))) return null;
  const ecart = enDollars(enCents(net) - enCents(netReference));
  return { ecart, alerte: Math.abs(ecart) > TOLERANCE_REFERENCE };
}

type PaieComplete = PaieSaisie & PaieCalculee;

const ligne = (compte: string, debit: number, credit: number, banque = false): LigneEcriture =>
  ({ compte, debit, credit, ...(banque ? { banque } : {}) });
const additionner = (...v: number[]) => enDollars(v.reduce((t, x) => t + enCents(x), 0));

export function ecriturePaie(p: PaieComplete): LigneEcriture[] {
  return [
    ligne("5100", p.brut, 0),
    ligne("5101", p.rqap_employeur, 0),
    ligne("5102", p.rrq_employeur, 0),
    ligne("5103", p.fss, 0),
    ligne("5104", p.ae_employeur, 0),
    ligne("5105", p.cnt, 0),
    ligne("5106", p.vacances, 0),
    ligne("5107", p.cnesst, 0),
    ligne("1010", 0, p.net, true),
    ligne("2151", 0, p.cnesst),
    ligne("2160", 0, p.vacances),
    ligne("2180", 0, additionner(p.ae, p.ae_employeur)),
    ligne("2190", 0, p.impot_federal),
    ligne("2200", 0, additionner(p.rrq, p.rrq_employeur)),
    ligne("2205", 0, p.impot_provincial),
    ligne("2210", 0, p.fss),
    ligne("2212", 0, additionner(p.rqap, p.rqap_employeur)),
    ligne("2215", 0, p.cnt),
  ].filter((l) => enCents(l.debit) !== 0 || enCents(l.credit) !== 0);
}

export type Palier = "federal" | "provincial";
export type DetailRemise = Record<string, number>; // compte de passif → montant

// Montants à remettre pour un palier, à partir des paies comptabilisées du mois
export function detailRemise(palier: Palier, paies: PaieComplete[]): DetailRemise {
  const somme = (f: (p: PaieComplete) => number) => additionner(...paies.map(f));
  const detail: DetailRemise = palier === "federal"
    ? {
        "2180": somme((p) => additionner(p.ae, p.ae_employeur)),
        "2190": somme((p) => p.impot_federal),
      }
    : {
        "2151": somme((p) => p.cnesst),
        "2200": somme((p) => additionner(p.rrq, p.rrq_employeur)),
        "2205": somme((p) => p.impot_provincial),
        "2210": somme((p) => p.fss),
        "2212": somme((p) => additionner(p.rqap, p.rqap_employeur)),
      };
  return detail;
}

export const totalRemise = (d: DetailRemise) => additionner(...Object.values(d));

export function ecritureRemise(d: DetailRemise): LigneEcriture[] {
  const lignes = Object.entries(d)
    .filter(([, m]) => enCents(m) !== 0)
    .map(([compte, m]) => ligne(compte, m, 0));
  return [...lignes, ligne("1010", 0, totalRemise(d), true)];
}

export const inverserEcriture = (lignes: LigneEcriture[]) =>
  lignes.map((l) => ({ ...l, debit: l.credit, credit: l.debit }));

export function equilibre(lignes: LigneEcriture[]) {
  const debit = lignes.reduce((t, l) => t + enCents(l.debit), 0);
  const credit = lignes.reduce((t, l) => t + enCents(l.credit), 0);
  return { debit: enDollars(debit), credit: enDollars(credit), equilibre: debit === credit && debit > 0 };
}

// Remettant régulier : le 15 du mois suivant ; reporté au lundi si ce jour tombe un week-end.
export function dateLimiteDAS(mois: string): string {
  const [a, m] = mois.slice(0, 7).split("-").map(Number);
  const d = new Date(Date.UTC(a, m, 15));
  const jour = d.getUTCDay();
  if (jour === 6) d.setUTCDate(17);
  if (jour === 0) d.setUTCDate(16);
  return d.toISOString().slice(0, 10);
}

export const moisDe = (date: string) => `${date.slice(0, 7)}-01`;

export const STATUTS_PAIE: Record<string, string> = {
  brouillon: "Brouillon",
  validee: "Validée",
  comptabilisee: "Comptabilisée",
  das_payees: "DAS payées",
};

export const NOMS_COMPTES: Record<string, string> = {
  "1010": "Banque",
  "2151": "CNESST à payer",
  "2160": "Vacances à payer",
  "2180": "Assurance-emploi à payer",
  "2190": "Impôt fédéral à payer",
  "2200": "RRQ à payer",
  "2205": "Impôt du Québec à payer",
  "2210": "FSS à payer",
  "2212": "RQAP à payer",
  "2215": "CNT à payer",
  "5100": "Salaires",
  "5101": "Charge RQAP employeur",
  "5102": "Charge RRQ employeur",
  "5103": "Charge FSS",
  "5104": "Charge A-E employeur",
  "5105": "Charge CNT",
  "5106": "Charge vacances",
  "5107": "Charge CNESST",
};
