-- Miroir des transferts : compte de destination d'une transaction de transfert.
-- Pour un transfert, compte_id = source et compte_destination_id = destination.
-- Pour toute autre transaction, reste NULL.
-- Purement additif : aucune ligne existante touchée, toutes restent à NULL.

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS compte_destination_id INTEGER REFERENCES comptes_bancaires(id);
