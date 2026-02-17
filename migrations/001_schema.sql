-- Table des catégories
CREATE TABLE IF NOT EXISTS categories (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(100) NOT NULL UNIQUE,
  type VARCHAR(20) NOT NULL CHECK (type IN ('dépense', 'revenu', 'neutre')),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des projets
CREATE TABLE IF NOT EXISTS projets (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  nom VARCHAR(200) NOT NULL,
  statut VARCHAR(50) DEFAULT 'En cours',
  compte_dedie VARCHAR(50),
  date_debut DATE,
  date_fin DATE,
  budget DECIMAL(12,2),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des contacts (clients + fournisseurs)
CREATE TABLE IF NOT EXISTS contacts (
  id SERIAL PRIMARY KEY,
  nom VARCHAR(200) NOT NULL,
  type VARCHAR(50) CHECK (type IN ('client', 'fournisseur', 'les deux')),
  email VARCHAR(200),
  telephone VARCHAR(50),
  adresse TEXT,
  numero_tps VARCHAR(50),
  numero_tvq VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table des comptes bancaires
CREATE TABLE IF NOT EXISTS comptes_bancaires (
  id SERIAL PRIMARY KEY,
  code VARCHAR(20) NOT NULL UNIQUE,
  nom VARCHAR(200) NOT NULL,
  institution VARCHAR(100),
  solde_initial DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Table principale des transactions
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  date_transaction DATE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('dépense', 'revenu', 'transfert')),
  numero VARCHAR(50),
  description TEXT,
  categorie_id INTEGER REFERENCES categories(id),
  projet_id INTEGER REFERENCES projets(id),
  contact_id INTEGER REFERENCES contacts(id),
  compte_id INTEGER REFERENCES comptes_bancaires(id),
  mode_paiement VARCHAR(50),
  montant_ht DECIMAL(12,2),
  tps DECIMAL(12,2) DEFAULT 0,
  tvq DECIMAL(12,2) DEFAULT 0,
  total_ttc DECIMAL(12,2),
  taxable BOOLEAN DEFAULT true,
  statut_facture VARCHAR(50),
  date_paiement DATE,
  numero_facture VARCHAR(100),
  piece_jointe_url TEXT,
  ocr_source BOOLEAN DEFAULT false,
  ocr_confiance DECIMAL(3,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table de jonction transactions <-> projets (many-to-many)
CREATE TABLE IF NOT EXISTS transaction_projets (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  projet_id INTEGER NOT NULL REFERENCES projets(id),
  part_montant DECIMAL(12,2),
  UNIQUE(transaction_id, projet_id)
);

-- Table des périodes fiscales
CREATE TABLE IF NOT EXISTS periodes_fiscales (
  id SERIAL PRIMARY KEY,
  periode VARCHAR(50) NOT NULL,
  date_debut DATE NOT NULL,
  date_fin DATE NOT NULL,
  tps_percue DECIMAL(12,2) DEFAULT 0,
  tps_payee DECIMAL(12,2) DEFAULT 0,
  tvq_percue DECIMAL(12,2) DEFAULT 0,
  tvq_payee DECIMAL(12,2) DEFAULT 0,
  reference TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date_transaction);
CREATE INDEX IF NOT EXISTS idx_transactions_projet ON transactions(projet_id);
CREATE INDEX IF NOT EXISTS idx_transactions_categorie ON transactions(categorie_id);
CREATE INDEX IF NOT EXISTS idx_transactions_compte ON transactions(compte_id);
CREATE INDEX IF NOT EXISTS idx_transaction_projets_tx ON transaction_projets(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_projets_pj ON transaction_projets(projet_id);
