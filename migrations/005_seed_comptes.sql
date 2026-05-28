INSERT INTO comptes_bancaires (code, nom, institution, solde_initial) VALUES
  ('CPT-20', 'Compte 1-20 Opérations', 'Desjardins', 12279.93),
  ('CPT-21', 'Compte 2-21 Production', 'Desjardins', 0),
  ('CPT-24', 'Compte 2-24 Whispering Forest', 'Desjardins', 8852.48),
  ('MC', 'Mastercard BN', 'Banque Nationale', 0),
  ('WISE', 'Wise Visa', 'Wise', 0)
ON CONFLICT (code) DO NOTHING;
