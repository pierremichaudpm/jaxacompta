CREATE TABLE IF NOT EXISTS budgets (
  id SERIAL PRIMARY KEY,
  categorie_id INTEGER REFERENCES categories(id),
  projet_id INTEGER REFERENCES projets(id),
  annee INTEGER NOT NULL,
  mois INTEGER,
  montant DECIMAL(12,2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(categorie_id, projet_id, annee, mois)
);
