-- Module « Paie employé » : fiche employé, paies, écritures en partie double, remises DAS,
-- paramètres annuels et journal des modifications. Additif : aucune table existante modifiée
-- (seule une catégorie de dépense est ajoutée).

-- Plan comptable de la paie (numérotation de la réquisition DAS)
CREATE TABLE IF NOT EXISTS comptes_gl (
  numero VARCHAR(10) PRIMARY KEY,
  nom VARCHAR(150) NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('actif', 'passif', 'charge', 'produit'))
);

INSERT INTO comptes_gl (numero, nom, type) VALUES
  ('1010', 'Banque', 'actif'),
  ('2151', 'CNESST à payer', 'passif'),
  ('2160', 'Vacances à payer', 'passif'),
  ('2180', 'Assurance-emploi à payer', 'passif'),
  ('2190', 'Impôt fédéral à payer', 'passif'),
  ('2200', 'RRQ à payer', 'passif'),
  ('2205', 'Impôt du Québec à payer', 'passif'),
  ('2210', 'FSS à payer', 'passif'),
  ('2212', 'RQAP à payer', 'passif'),
  ('2215', 'CNT à payer', 'passif'),
  ('5100', 'Salaires', 'charge'),
  ('5101', 'Charge RQAP employeur', 'charge'),
  ('5102', 'Charge RRQ employeur', 'charge'),
  ('5103', 'Charge FSS', 'charge'),
  ('5104', 'Charge A-E employeur', 'charge'),
  ('5105', 'Charge CNT', 'charge'),
  ('5106', 'Charge vacances', 'charge'),
  ('5107', 'Charge CNESST', 'charge')
ON CONFLICT (numero) DO NOTHING;

-- Taux et plafonds par année. Les colonnes non utilisées par le calcul actuel
-- (impôts, RRQ) préparent un calcul automatique futur.
CREATE TABLE IF NOT EXISTS paie_parametres (
  annee INTEGER PRIMARY KEY,
  rqap_taux_employe DECIMAL(7,5),
  rqap_taux_employeur DECIMAL(7,5) NOT NULL,
  rqap_max_assurable DECIMAL(12,2) NOT NULL,
  ae_taux_employe DECIMAL(7,5),
  ae_ratio_employeur DECIMAL(4,2) NOT NULL DEFAULT 1.4,
  ae_max_assurable DECIMAL(12,2),
  rrq_taux DECIMAL(7,5),
  rrq_exemption DECIMAL(12,2),
  rrq_max_gains DECIMAL(12,2),
  fss_taux DECIMAL(7,5) NOT NULL,
  cnt_taux DECIMAL(7,5) NOT NULL,
  cnt_max_assurable DECIMAL(12,2) NOT NULL,
  cnesst_taux DECIMAL(7,4) NOT NULL DEFAULT 0,   -- $ par 100 $ de salaire (avis de cotisation)
  cnesst_max_assurable DECIMAL(12,2),
  mpb_provincial DECIMAL(12,2),
  mpb_federal DECIMAL(12,2),
  updated_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO paie_parametres (annee, rqap_taux_employe, rqap_taux_employeur, rqap_max_assurable,
  ae_taux_employe, ae_ratio_employeur, ae_max_assurable, fss_taux, cnt_taux, cnt_max_assurable,
  cnesst_taux, mpb_provincial, mpb_federal)
VALUES (2026, 0.00430, 0.00602, 103000, 0.01300, 1.4, 68900, 0.01650, 0.00060, 103000,
  0, 18952, 16452)
ON CONFLICT (annee) DO NOTHING;

CREATE TABLE IF NOT EXISTS employes (
  id SERIAL PRIMARY KEY,
  prenom VARCHAR(100) NOT NULL,
  nom VARCHAR(100) NOT NULL,
  actionnaire BOOLEAN NOT NULL DEFAULT false,
  statut VARCHAR(10) NOT NULL DEFAULT 'actif' CHECK (statut IN ('actif', 'inactif')),
  date_embauche DATE,
  poste VARCHAR(150),
  adresse TEXT,
  courriel VARCHAR(200),
  nas_derniers3 CHAR(3) CHECK (nas_derniers3 ~ '^[0-9]{3}$'),  -- jamais le NAS complet
  taux_horaire DECIMAL(10,2),
  heures_semaine DECIMAL(5,2),
  periodes_par_an INTEGER NOT NULL DEFAULT 26 CHECK (periodes_par_an IN (12, 24, 26, 52)),
  mpb_provincial DECIMAL(12,2),
  mpb_federal DECIMAL(12,2),
  assujetti_ae BOOLEAN NOT NULL DEFAULT true,
  assujetti_cnesst BOOLEAN NOT NULL DEFAULT true,
  taux_vacances DECIMAL(5,4) NOT NULL DEFAULT 0.04,
  compte_bancaire_id INTEGER REFERENCES comptes_bancaires(id),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Employée actionnaire, non assujettie à l'assurance-emploi. Fiche à compléter dans l'app.
INSERT INTO employes (prenom, nom, actionnaire, assujetti_ae, periodes_par_an, mpb_provincial, mpb_federal)
SELECT 'Virginie', 'Jaffredo', true, false, 26, 18952, 16452
WHERE NOT EXISTS (SELECT 1 FROM employes WHERE prenom = 'Virginie' AND nom = 'Jaffredo');

CREATE TABLE IF NOT EXISTS ecritures (
  id SERIAL PRIMARY KEY,
  date_ecriture DATE NOT NULL,
  libelle TEXT NOT NULL,
  source VARCHAR(20) NOT NULL CHECK (source IN ('paie', 'remise_das', 'annulation')),
  source_id INTEGER,
  annule_ecriture_id INTEGER REFERENCES ecritures(id),
  annulee BOOLEAN NOT NULL DEFAULT false,
  created_by VARCHAR(200),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ecriture_lignes (
  id SERIAL PRIMARY KEY,
  ecriture_id INTEGER NOT NULL REFERENCES ecritures(id) ON DELETE CASCADE,
  compte_numero VARCHAR(10) NOT NULL REFERENCES comptes_gl(numero),
  compte_bancaire_id INTEGER REFERENCES comptes_bancaires(id),
  debit DECIMAL(12,2) NOT NULL DEFAULT 0,
  credit DECIMAL(12,2) NOT NULL DEFAULT 0,
  CHECK (debit >= 0 AND credit >= 0 AND (debit = 0 OR credit = 0))
);

CREATE TABLE IF NOT EXISTS paies (
  id SERIAL PRIMARY KEY,
  employe_id INTEGER NOT NULL REFERENCES employes(id),
  date_paie DATE NOT NULL,
  periode_debut DATE,
  periode_fin DATE,
  heures DECIMAL(7,2),
  -- Saisie (calculateur externe : Impot.net, WinRAS, CDRP)
  brut DECIMAL(12,2) NOT NULL,
  ae DECIMAL(12,2) NOT NULL DEFAULT 0,
  rqap DECIMAL(12,2) NOT NULL DEFAULT 0,
  rrq DECIMAL(12,2) NOT NULL DEFAULT 0,
  impot_federal DECIMAL(12,2) NOT NULL DEFAULT 0,
  impot_provincial DECIMAL(12,2) NOT NULL DEFAULT 0,
  fss DECIMAL(12,2) NOT NULL DEFAULT 0,
  net_reference DECIMAL(12,2),
  -- Calculé par le serveur et figé à la sauvegarde
  net DECIMAL(12,2) NOT NULL,
  rqap_employeur DECIMAL(12,2) NOT NULL,
  rrq_employeur DECIMAL(12,2) NOT NULL,
  ae_employeur DECIMAL(12,2) NOT NULL,
  cnt DECIMAL(12,2) NOT NULL,
  cnesst DECIMAL(12,2) NOT NULL,
  vacances DECIMAL(12,2) NOT NULL,
  das_federal DECIMAL(12,2) NOT NULL,
  das_provincial DECIMAL(12,2) NOT NULL,
  statut VARCHAR(20) NOT NULL DEFAULT 'brouillon'
    CHECK (statut IN ('brouillon', 'validee', 'comptabilisee', 'das_payees')),
  compte_bancaire_id INTEGER REFERENCES comptes_bancaires(id),
  piece_jointe_key TEXT,
  piece_jointe_nom TEXT,
  ecriture_id INTEGER REFERENCES ecritures(id),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_paies_date ON paies(date_paie);
CREATE INDEX IF NOT EXISTS idx_paies_employe ON paies(employe_id, date_paie);

CREATE TABLE IF NOT EXISTS remises_das (
  id SERIAL PRIMARY KEY,
  mois DATE NOT NULL,                       -- 1er jour du mois des paies
  palier VARCHAR(10) NOT NULL CHECK (palier IN ('federal', 'provincial')),
  montant DECIMAL(12,2) NOT NULL,
  detail JSONB NOT NULL,
  date_limite DATE NOT NULL,
  date_paiement DATE NOT NULL,
  compte_bancaire_id INTEGER REFERENCES comptes_bancaires(id),
  demande_par VARCHAR(150),
  approuve_par VARCHAR(150),
  ecriture_id INTEGER REFERENCES ecritures(id),
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE (mois, palier)
);

CREATE TABLE IF NOT EXISTS journal_modifications (
  id SERIAL PRIMARY KEY,
  table_nom VARCHAR(50) NOT NULL,
  enregistrement_id INTEGER,
  action VARCHAR(30) NOT NULL,
  utilisateur VARCHAR(200),
  avant JSONB,
  apres JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_journal_modifs_date ON journal_modifications(created_at DESC);

-- Sorties de banque de la paie (salaire net, remises DAS) dans la comptabilité de caisse
INSERT INTO categories (nom, type) VALUES ('Salaires et charges sociales', 'dépense')
ON CONFLICT (nom) DO NOTHING;
