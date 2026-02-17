INSERT INTO categories (nom, type) VALUES
  ('Services professionnels', 'dépense'),
  ('Bureau', 'dépense'),
  ('Bureau – Logiciel', 'dépense'),
  ('Transport', 'dépense'),
  ('Frais bancaires', 'dépense'),
  ('Équipement', 'dépense'),
  ('Événement', 'dépense'),
  ('Hôtel / Logement', 'dépense'),
  ('Part actionnaire', 'dépense'),
  ('Transfert interne', 'neutre'),
  ('Remboursement', 'dépense'),
  ('Gouvernement', 'dépense'),
  ('Dépense actionnaire', 'dépense'),
  ('Revenu client', 'revenu')
ON CONFLICT (nom) DO NOTHING;
