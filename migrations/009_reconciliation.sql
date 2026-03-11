ALTER TABLE transactions ADD COLUMN IF NOT EXISTS rapproche BOOLEAN DEFAULT false;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS date_rapprochement DATE;

CREATE TABLE IF NOT EXISTS sessions_rapprochement (
  id SERIAL PRIMARY KEY,
  compte_id INTEGER NOT NULL REFERENCES comptes_bancaires(id),
  date_releve DATE NOT NULL,
  solde_releve DECIMAL(12,2) NOT NULL,
  solde_systeme DECIMAL(12,2),
  ecart DECIMAL(12,2),
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
