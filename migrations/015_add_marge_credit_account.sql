-- Ajoute la marge de crédit Banque Nationale comme compte réel.
-- Jusqu'ici représentée uniquement par le contact 38 "JAXA - MARGE DE CREDIT".
-- Additif : aucune ligne existante touchée. Le contact 38 n'est pas modifié ici.

INSERT INTO comptes_bancaires (code, nom, institution, solde_initial) VALUES
  ('MARGE-BN', 'Marge de crédit Banque Nationale', 'Banque Nationale', 0)
ON CONFLICT (code) DO NOTHING;
