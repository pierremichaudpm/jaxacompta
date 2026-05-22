# WORKING_LOG — JAXA Compta

## Session 2026-05-22

### Progres

1. **Migration d'hebergement Netlify suite a suppression de compte sans preavis**
   - Ancien site : `jaxa-compta.netlify.app` (compte `pmicho@pm.me`) — supprime sans avertissement
   - Nouveau site : `comptajaxa.netlify.app` (compte `pierre.michaud@jaxa.ca`)
   - Connexion GitHub → auto-deploy sur push vers main
   - Zéro perte de données : la DB Neon était indépendante de Netlify

2. **Recuperation de la base de données Neon**
   - Projet Neon `young-silence-09986893` toujours accessible sur console.neon.tech
   - 32.2 MB de données intactes, derniere activite 2 jours avant la migration
   - Connection string reconfigurée manuellement comme variable d'environnement

3. **Reconfiguration des variables d'environnement sur le nouveau site**
   - `NETLIFY_DATABASE_URL` : connection string Neon (ep-empty-block-ae3yh5th)
   - `APP_PASSWORD` : mot de passe de connexion a l'app
   - `ANTHROPIC_API_KEY` : cle API Claude pour l'OCR

4. **Mise a jour CLAUDE.md**
   - URL → `https://comptajaxa.netlify.app`
   - Nouvelle section Neon DB avec nom du projet et note d'independance
   - Section Deploy simplifiee

### Decisions techniques

- **Garder la meme DB Neon** : zero migration de donnees necessaire, connexion par URL directe sans passer par l'extension Netlify Neon
- **Compte Netlify** : `pierre.michaud@jaxa.ca` (compte JAXA qui heberge aussi jaxapatsy, jaxamail, etc.)
- **Ne pas utiliser l'extension Netlify Neon** sur le nouveau site : `NETLIFY_DATABASE_URL` configurée comme variable manuelle standard pour eviter toute dependance a l'extension

### Problemes rencontres et resolus

1. **Compte Netlify `pmicho@pm.me` supprime sans preavis**
   - Toutes les variables d'environnement perdues avec le compte
   - Resolution : recuperation depuis neon.tech + re-saisie manuelle des secrets

2. **`NETLIFY_DATABASE_URL` invisible via CLI**
   - L'extension Neon injecte la variable hors du systeme standard → `netlify env:list` retournait vide
   - Resolution : recuperation directe depuis la console Neon

3. **CLI netlify pointe vers un site fantome apres suppression du compte**
   - `netlify link` retournait `undefined` car le site original n'existait plus
   - Resolution : `netlify unlink` puis `netlify link --name comptajaxa`

### Lecon apprise

**La DB Neon est independante de Netlify.** Toujours noter la connection string Neon separément des credentials Netlify — c'est ce qui a permis la recuperation sans perte de donnees.

### Prochaines etapes

- [ ] Ajouter le champ `notes` dans le payload de `handleCreate` (formNotes non envoye a l'API)
- [ ] Tester creation facture Studio Micho (branding "micho") — verifier logo PDF apres les commits recents de branding
- [ ] Re-editer les factures existantes creees avec branding "micho" pour corriger en DB
- [ ] Remplacer les `alert()` par des toasts shadcn/ui

---

## Session 2026-03-17

### Progres

1. **Migration 012 (branding) executee sur la DB prod**
   - La colonne `branding VARCHAR(50) DEFAULT 'jaxa'` n'existait pas en production
   - L'INSERT dans `factures.mts` referençait `${data.branding}` → erreur PostgreSQL
   - Symptome cote utilisateur : "Erreur lors de l'enregistrement : Erreur serveur" a la creation de facture
   - Executee via node + pg de netlify-cli

2. **Migration 013 (contact adresses) executee sur la DB prod**
   - Meme probleme : colonne `adresses` manquante, creation/modification de contact impossible
   - 31 contacts existants migres avec adresses legacy

3. **Verification de l'etat complet de la DB prod**
   - Tables presentes : budgets, recurrences, sessions_rapprochement (migrations 008-010 OK)
   - Colonne lignes_facture presente (migration 006 OK)
   - Seules les migrations 012 et 013 manquaient

### Decisions techniques

- **Pas de changement de code** : le code deploye etait correct, seule la DB manquait les colonnes
- **Migration via node** : psql non installe, utilisation de `require('/usr/local/lib/node_modules/netlify-cli/node_modules/pg')` comme workaround

### Problemes rencontres et resolus

1. **"Erreur serveur" a la creation de facture**
   - Cause : migration 012 non executee → colonne `branding` inexistante
   - L'INSERT dans factures.mts POST incluait `${data.branding || 'jaxa'}` → PostgreSQL rejetait
   - Resolution : `ALTER TABLE transactions ADD COLUMN branding VARCHAR(50) DEFAULT 'jaxa'`

2. **Contacts non modifiables** (meme session precedente)
   - Cause : migration 013 non executee → colonne `adresses` inexistante
   - Resolution : execution de la migration + migration des adresses legacy

3. **PDF Studio Micho affiche logo Jaxa**
   - Le code `generateFacturePDF.ts` gere correctement le branding (lignes 49-56)
   - Le probleme etait que `branding` n'etait pas sauvegarde en DB (colonne manquante)
   - `tx.branding` retournait `undefined` → fallback sur logo Jaxa
   - Resolution : maintenant que la colonne existe, les nouvelles factures enregistrent le bon branding
   - Les factures existantes creees avec branding "micho" doivent etre re-editees pour corriger

### Lecon apprise

**Toujours verifier l'etat des migrations en prod avant de debugger le code.** Deux sessions de debug ont ete causees par des migrations non executees. Ajouter une verification systematique en debut de session.

---

## Session 2026-03-11

### Progres

1. **Contacts multi-adresses**
   - ContactList : CRUD standalone avec support multi-adresses (label + adresse)
   - Accessible depuis Factures via bouton "Contacts" + early return pattern
   - Selecteur d'adresse de facturation dans le formulaire de facture (quand client a >1 adresses)
   - Migration 013 : `ALTER TABLE contacts ADD COLUMN adresses TEXT DEFAULT '[]'`

2. **Annulation et suppression de factures**
   - Statut "Annulee" ajoute dans STATUT_OPTIONS et STATUT_COLORS
   - Bouton Ban (orange) pour annuler, Trash2 (rouge) pour supprimer
   - DELETE handler dans factures.mts

3. **Error handling global**
   - ContactList `handleSave` / `handleDelete` : ajoute try-catch avec alert()
   - ContactList `openEdit` : Array.isArray defensif pour adresses
   - Factures `handleCreate` : try-catch avec alert()
   - Factures : sauvegarde API separee du PDF (non-bloquante)
   - Factures : message rouge pour champs manquants (client/numero/montant)

4. **Git + Deploy**
   - Push vers `origin/main` (GitHub: pierremichaudpm/jaxacompta)
   - Netlify auto-deploy configure et fonctionnel

### Prochaines etapes

- [ ] Tester creation facture Studio Micho (branding "micho") — verifier logo PDF
- [ ] Re-editer les factures existantes creees avec branding "micho" pour corriger en DB
- [ ] Ajouter le champ `notes` dans le payload de `handleCreate` (formNotes non envoye a l'API)
- [ ] Remplacer les `alert()` par des toasts shadcn/ui (optionnel)
- [ ] Envisager un script de verification des migrations au demarrage ou en CI
