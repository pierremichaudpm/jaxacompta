# CLAUDE.md — JAXA Compta

## Projet

Application web comptable pour JAXA Production Inc. React SPA avec Netlify Functions backend.

## Stack

| Couche | Technologie |
|--------|------------|
| Frontend | React 18 + Vite 7 + TypeScript + Tailwind v4 + shadcn/ui |
| Backend | Netlify Functions (.mts) + @netlify/neon (PostgreSQL) + @netlify/blobs |
| OCR | Anthropic API (claude-sonnet-4-6) |
| PDF | jsPDF + jspdf-autotable |
| Excel | SheetJS (xlsx) — export bilan comptable multi-onglets |
| Hosting | Netlify (site: `comptajaxa`, compte `pierre.michaud@jaxa.ca`) |
| Repo | `git@github.com:pierremichaudpm/jaxacompta.git` (branch: main) |
| URL | https://comptajaxa.netlify.app |

## Structure

```
jaxa-compta/
├── src/
│   ├── components/       # React components (Dashboard, Factures, ContactList, etc.)
│   ├── components/ui/    # shadcn/ui primitives
│   ├── lib/              # api.ts, generateFacturePDF.ts, generateBilanExcel.ts, companyInfo.ts, logo*Base64.ts
│   └── types/index.ts    # Shared TypeScript interfaces
├── netlify/functions/    # Backend API (.mts files)
│   ├── lib/auth.ts       # Shared auth middleware
│   ├── factures.mts      # /api/factures (CRUD + next_number)
│   ├── contacts.mts      # /api/contacts (CRUD + adresses JSON)
│   ├── transactions.mts  # /api/transactions
│   ├── projets.mts       # /api/projets
│   ├── ocr.mts           # /api/ocr (Claude Vision)
│   └── ...
├── migrations/           # SQL migrations (001-016)
└── dist/                 # Build output (deployed to Netlify)
```

## Conventions

- UI entierement en francais
- API REST : `/api/resource`, methodes GET/POST/PUT/DELETE
- Auth : Bearer token (base64-encoded JSON, 7 jours)
- Neon SQL : tagged templates `sql\`...\`` ou `sql.query()` pour dynamic WHERE
- Dates ISO 8601 (`YYYY-MM-DD`), montants `DECIMAL(12,2)`
- Factures = transactions de type 'revenu' avec `numero_facture` et `lignes_facture` (JSON)

## Deploy

```bash
# Auto-deploy : push to main → Netlify builds from GitHub
git push origin main

# Build + deploy manuel (authentification compte pierre.michaud@jaxa.ca)
npm run build && npx netlify deploy --prod --dir=dist
```

## Neon DB

Projet : `young-silence-09986893` — AWS US East 2 (Ohio)
Acces : console.neon.tech (compte Pierre, Free tier)
**Important** : la DB est independante de Netlify. Si le compte Netlify change, la DB survit.

## Migrations

Executer via psql contre la DB Neon :
```bash
netlify env:get NETLIFY_DATABASE_URL
psql "$URL" -f migrations/XXX_name.sql
```

Migrations actuelles : 001 (schema) → 016 (compte_destination_id). 001-013 executees sur la DB prod (incluant 012 branding, executee le 2026-03-17).

**⚠️ 014, 015, 016 PAS encore appliquees en prod (2026-06-29)** — committees mais non executees. Elles ajoutent `id_transfert`/`is_transfert` (014), le compte Marge de credit BN (015) et `compte_destination_id` (016). Toute la chaine des transferts (miroir, suppression/edition de paire) echouera en prod tant qu'elles ne sont pas appliquees, dans l'ordre 014 → 015 → 016, apres backup verifie.

Pas de table de suivi des migrations ni de runner : application 100% manuelle via psql. `scripts/migrate.mjs` est un bootstrap obsolete (fige a 001-005), ne pas s'y fier.

**Attention aux migrations manquantes** : le code peut referencer des colonnes ajoutees par des migrations recentes. Si une feature echoue avec "Erreur serveur", verifier que toutes les migrations ont bien ete executees sur la DB prod.

Si psql n'est pas installe, utiliser node avec le module pg global :
```bash
node -e "
const { Client } = require('/usr/local/lib/node_modules/netlify-cli/node_modules/pg');
const c = new Client(process.env.DB_URL);
c.connect().then(() => c.query('SELECT 1')).then(r => { console.log(r.rows); c.end(); });
"
```

## Patterns importants

- **Factures PUT** : `isFullEdit = data.montant_ht !== undefined` pour distinguer edit complet vs changement de statut
- **Contacts adresses** : colonne `adresses TEXT DEFAULT '[]'` (JSON), parsee par l'API en GET, stringifiee en POST/PUT
- **Branding** : `branding VARCHAR(50) DEFAULT 'jaxa'` — valeurs 'jaxa' ou 'micho'
- **Contacts dans Factures** : sous-vue via `showContacts` early return (pas un onglet separe)
- **PDF** : genere cote client via `generateFacturePDF()`, separe de la sauvegarde API
- **Excel bilan** : genere cote client via `generateBilanExcel()` — 3 onglets (Transactions, Sommaire comptable, Par categorie), format professionnel pour le comptable
- **Miroir des transferts** : un transfert = 2 lignes liees par `id_transfert`, `is_transfert=true`. Declencheur cote serveur = `compte_destination_id` non NULL (PAS le type ni la categorie). POST genere la paire source (`type='dépense'`) + miroir (`type='revenu'`) en UNE seule instruction CTE atomique (le driver Neon HTTP ne fait pas de transaction multi-requetes) ; l'id source est pre-alloue via `nextval(pg_get_serial_sequence(...))` et sert d'`id_transfert` commun. Anti-boucle : la miroir n'est jamais re-traitee (insert direct, pas de re-POST). Idempotence : pas de re-paire si `id_transfert` deja pose. Les transferts sont exclus du resultat (`is_transfert=false` dans les totaux de `rapports.mts`) mais restent dans le solde des comptes. DELETE d'une patte supprime les deux (`WHERE id_transfert = X`). PUT d'une patte propage uniquement les champs surs (date, montant, taxes a 0) aux deux pattes ; type/comptes restent croises et figes (enforcement serveur autoritaire). Le form (`TransactionForm`) envoie `compte_destination_id` UNIQUEMENT en mode transfert (force a null sur tout autre type).

## Contexte global
Voir ~/Documents/CONTEXT.md pour le profil complet,
les conventions transversales et la liste des clients actifs.
