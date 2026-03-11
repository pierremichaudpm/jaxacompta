CREATE TABLE IF NOT EXISTS recurrences (
  id SERIAL PRIMARY KEY,
  type VARCHAR(20) NOT NULL CHECK (type IN ('dépense', 'revenu', 'transfert')),
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
  notes TEXT,
  frequence VARCHAR(20) NOT NULL CHECK (frequence IN ('hebdomadaire', 'mensuel', 'trimestriel', 'annuel')),
  date_debut DATE NOT NULL,
  date_fin DATE,
  prochaine_date DATE NOT NULL,
  actif BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS recurrence_id INTEGER REFERENCES recurrences(id);
