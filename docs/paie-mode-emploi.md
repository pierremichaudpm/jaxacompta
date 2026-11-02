# Paie employé — mode d'emploi

Onglet **Paie employé** de JAXA Compta. Accès : Virginie (connexion « Accès par courriel » avec le compte paie) en lecture et écriture ; le comptable (accès invité) en consultation et exports. Le mot de passe d'équipe n'ouvre pas la paie.

L'outil ne calcule pas l'impôt ni les cotisations de l'employé : on les recopie d'un calculateur (Impot.net, WinRAS ou CDRP). L'outil calcule tout le reste : part employeur, salaire net, DAS, écriture comptable, cumulatifs.

## Une fois par année (janvier)

1. **Paramètres** : vérifier les taux de l'année (RQAP employeur, FSS, CNT, maximums assurables) et saisir le **taux CNESST** de l'avis de cotisation. Sans paramètres pour l'année, aucune paie ne peut être saisie.
2. **Employés** : mettre à jour les montants personnels de base et, au besoin, le taux horaire.

## Chaque paie (aux 2 semaines)

1. **Paies → Nouvelle paie** : choisir l'employé et la date de paie.
2. L'encadré **« À reporter dans le calculateur »** donne le nombre de périodes, les montants de base, la case A-E à cocher ou non, et les **cumulatifs avant cette période** (RRQ, RQAP, PAE, salaire).
3. Dans **Impot.net** : saisir ces valeurs et le salaire brut, puis lancer le calcul. Enregistrer le résultat en PDF.
4. De retour dans JAXA Compta, recopier : salaire brut, A-E, RQAP, RRQ, impôt fédéral, impôt provincial, FSS (le bouton **Suggérer** propose brut × taux FSS), et le **salaire net affiché** par Impot.net.
5. Joindre le PDF, vérifier le **compte bancaire** du salaire net, puis **Enregistrer**. Un écart de 0,01 $ avec Impot.net est normal (Impot.net arrondit autrement) ; au-delà de 0,02 $, un avertissement rouge s'affiche : revérifier la saisie.
6. **Valider** la paie après relecture, puis **Comptabiliser**. Cela publie l'écriture (débits = crédits, sinon c'est bloqué) et crée la sortie de banque du salaire net dans les transactions.
7. Verser le salaire net à l'employé.

Pour corriger une paie comptabilisée : **Annuler** (crée une écriture d'annulation et remet la paie en brouillon), corriger, puis revalider et recomptabiliser.

## Chaque mois : remises DAS (avant le 15 du mois suivant)

1. **DAS** : le mois regroupe toutes les paies comptabilisées (2 ou 3 paies par mois). Le tableau de bord affiche un rappel, en rouge si la date limite est passée.
2. Inscrire **Demandé par / Approuvé par**, puis télécharger les **réquisitions** : PDF par palier, ou Excel (onglets Fédéral et Provincial, compatible Google Sheets).
3. Payer les deux remises :
   - **Fédéral** (Receveur général) : impôt fédéral + A-E employé et employeur ;
   - **Provincial** (Ministre du Revenu du Québec) : impôt du Québec + RRQ (×2) + RQAP (employé + employeur) + FSS + CNESST.
4. Cliquer **Marquer payée** pour chaque palier (date et compte bancaire). L'écriture de sortie (débit des comptes à payer, crédit Banque) et la transaction sont créées. Quand les deux paliers sont payés, les paies passent à **DAS payées**.

## Fin d'année

- **Tableau de bord → Export Excel** : sommaire mensuel, détail des paies, remises DAS et récapitulatif **T4 / RL-1** (à valider par le comptable).
- **CNT** : provisionnée à chaque paie (compte 2215), payée avec le Sommaire 1 (RL-1) au plus tard le dernier jour de février.
- **Vacances** : provisionnées à chaque paie (compte 2160). Elles deviennent un revenu d'emploi quand elles sont versées.

## Plan comptable de la paie

| Débit (charges) | Crédit (à payer) |
|---|---|
| 5100 Salaires | 1010 Banque (salaire net) |
| 5101 Charge RQAP employeur | 2151 CNESST à payer |
| 5102 Charge RRQ employeur | 2160 Vacances à payer |
| 5103 Charge FSS | 2180 Assurance-emploi à payer |
| 5104 Charge A-E employeur | 2190 Impôt fédéral à payer |
| 5105 Charge CNT | 2200 RRQ à payer |
| 5106 Charge vacances | 2205 Impôt du Québec à payer |
| 5107 Charge CNESST | 2210 FSS à payer |
| | 2212 RQAP à payer |
| | 2215 CNT à payer |

## Règles de calcul

- Net = brut − A-E − RQAP − RRQ − impôt fédéral − impôt provincial.
- RQAP employeur = revenu assurable × taux employeur de l'année (0,602 % en 2026), comme Revenu Québec et Impot.net ; 0 si l'employé ne cotise pas.
- A-E employeur = A-E employé × 1,4. RRQ employeur = RRQ employé.
- CNT = 0,06 % du revenu assurable ; CNESST = brut × taux / 100 ; vacances = brut × taux de la fiche (4 %).
- Montants arrondis au cent à chaque ligne.
- Exemple (paie de 1 590 $ du PDF Impot.net) : net 1 500,74 $, DAS fédéral 0,62 $, DAS provincial 206,25 $, écriture 1 772,16 $ = 1 772,16 $.

Toutes les modifications (paies, fiches, remises, paramètres) sont inscrites dans **Journal → Journal des modifications**, avec la personne et l'heure. Aucune donnée de paie n'est envoyée à un service d'IA.
