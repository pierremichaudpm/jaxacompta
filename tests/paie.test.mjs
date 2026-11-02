import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculerPaie, dateLimiteDAS, detailRemise, ecartReference, ecriturePaie, ecritureRemise,
  equilibre, fssSuggeree, inverserEcriture, totalRemise,
} from '../src/lib/paieCalcul.ts';

// Paramètres 2026 (migration 017), CNESST à 0 tant que le taux de l'avis n'est pas saisi
const p2026 = {
  rqap_taux_employeur: 0.00602, rqap_max_assurable: 103000, ae_ratio_employeur: 1.4,
  cnt_taux: 0.0006, cnt_max_assurable: 103000, cnesst_taux: 0, cnesst_max_assurable: null,
  fss_taux: 0.0165,
};
const ctx = { cumul_brut_avant: 0, assujetti_cnesst: true, taux_vacances: 0.04 };
// Paie de référence : PDF Impot.net du 30/10/2026
const saisie = { brut: 1590, ae: 0, rqap: 6.84, rrq: 81.8, impot_federal: 0.62, impot_provincial: 0, fss: 26.24 };

test('cas de validation 1 590 $ : net, part employeur et DAS', () => {
  const c = calculerPaie(saisie, p2026, ctx);
  assert.equal(c.net, 1500.74);
  assert.equal(c.rqap_employeur, 9.57); // 1 590 × 0,602 %, comme Impot.net
  assert.equal(c.rrq_employeur, 81.8);
  assert.equal(c.ae_employeur, 0);
  assert.equal(c.cnt, 0.95);
  assert.equal(c.vacances, 63.6);
  assert.equal(c.cnesst, 0);
  assert.equal(c.das_federal, 0.62);
  assert.equal(c.das_provincial, 206.25); // RRQ 163,60 + RQAP 16,41 + FSS 26,24
  assert.equal(fssSuggeree(1590, p2026), 26.24);
});

test('écart avec le net Impot.net (1 500,75) toléré à 0,02 $', () => {
  assert.deepEqual(ecartReference(1500.74, 1500.75), { ecart: -0.01, alerte: false });
  assert.equal(ecartReference(1500.74, 1500.80).alerte, true);
  assert.equal(ecartReference(1500.74, null), null);
});

test('écriture de la paie 1 590 $ équilibrée à 1 772,16 $', () => {
  const lignes = ecriturePaie({ ...saisie, ...calculerPaie(saisie, p2026, ctx) });
  assert.deepEqual(equilibre(lignes), { debit: 1772.16, credit: 1772.16, equilibre: true });
  const montant = compte => lignes.find(l => l.compte === compte);
  assert.equal(montant('1010').credit, 1500.74);
  assert.equal(montant('1010').banque, true);
  assert.equal(montant('2212').credit, 16.41);
  assert.equal(montant('2200').credit, 163.6);
  assert.equal(montant('2160').credit, 63.6);
  assert.equal(montant('2215').credit, 0.95);
  assert.equal(montant('2180'), undefined, 'les lignes à 0 sont omises');
});

test('employé assujetti : A-E employeur × 1,4, CNESST et retenues équilibrées', () => {
  const s = { ...saisie, ae: 20.67, impot_provincial: 12.34 };
  const c = calculerPaie(s, { ...p2026, cnesst_taux: 1.52 }, ctx);
  assert.equal(c.ae_employeur, 28.94);
  assert.equal(c.net, 1467.73);
  assert.equal(c.cnesst, 24.17);
  assert.equal(c.das_federal, 50.23);
  assert.equal(c.das_provincial, 242.76); // 206,25 + impôt Québec 12,34 + CNESST 24,17
  assert.equal(equilibre(ecriturePaie({ ...s, ...c })).equilibre, true);
  assert.equal(calculerPaie(s, { ...p2026, cnesst_taux: 1.52 }, { ...ctx, assujetti_cnesst: false }).cnesst, 0);
});

test('arrondi au cent à chaque ligne et plafonds annuels', () => {
  assert.equal(calculerPaie({ ...saisie, ae: 6.84 }, p2026, ctx).ae_employeur, 9.58); // 9,576 → 9,58
  const presqueMax = { ...ctx, cumul_brut_avant: 102000 };
  assert.equal(calculerPaie(saisie, p2026, presqueMax).rqap_employeur, 6.02); // 1 000 $ assurables
  assert.equal(calculerPaie(saisie, p2026, { ...ctx, cumul_brut_avant: 103000 }).cnt, 0);
  assert.equal(calculerPaie({ ...saisie, rqap: 0 }, p2026, ctx).rqap_employeur, 0);
});

test('une écriture déséquilibrée ou vide est refusée', () => {
  const lignes = ecriturePaie({ ...saisie, ...calculerPaie(saisie, p2026, ctx) });
  lignes[0] = { ...lignes[0], debit: lignes[0].debit + 0.01 };
  assert.equal(equilibre(lignes).equilibre, false);
  assert.equal(equilibre([]).equilibre, false);
  assert.equal(equilibre(inverserEcriture(ecritureRemise({ '2190': 0.62 }))).equilibre, true);
});

test('remises DAS du mois et date limite au 15 du mois suivant', () => {
  const paie = { ...saisie, ...calculerPaie(saisie, p2026, ctx) };
  const fed = detailRemise('federal', [paie, paie]);
  const prov = detailRemise('provincial', [paie]);
  assert.equal(totalRemise(fed), 1.24);
  assert.equal(totalRemise(prov), 206.25);
  assert.deepEqual(equilibre(ecritureRemise(prov)), { debit: 206.25, credit: 206.25, equilibre: true });
  assert.equal(dateLimiteDAS('2026-11-01'), '2026-12-15');
  assert.equal(dateLimiteDAS('2026-12-01'), '2027-01-15');
  assert.equal(dateLimiteDAS('2027-07-01'), '2027-08-16'); // 15 août 2027 = dimanche
});
