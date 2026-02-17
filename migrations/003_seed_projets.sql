INSERT INTO projets (code, nom, statut, compte_dedie) VALUES
  ('CARI', 'Cari St Laurent', 'En cours', 'Cpte 1-20'),
  ('OAN', 'Orlade Amérique du Nord', 'En cours', 'Cpte 1-20'),
  ('EISL', 'Excellence industrielle St-Laurent', 'En cours', 'Cpte 1-20'),
  ('Tonic', 'Groupe Tonic – GTCQM PWA', 'En cours', 'Cpte 1-20'),
  ('WF', 'Whispering Forest', 'En cours', 'Cpte 2-24'),
  ('FIS', 'La Fissure – FMC', 'En cours', 'Cpte 2-21'),
  ('FA', 'Féerie Aquatique', 'En cours', 'Cpte 1-20'),
  ('WE ARE', 'WE ARE (coprod. 4D ART)', 'En cours', 'Cpte 1-20'),
  ('JR', 'Joseph Rouleau', 'Complété', 'Cpte 1-20'),
  ('CTV', 'Couleur.tv', 'En cours', 'Cpte 1-20'),
  ('Général', 'Dépenses non liées à un projet', 'Actif', NULL)
ON CONFLICT (code) DO NOTHING;
