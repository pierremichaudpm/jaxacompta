-- Miroir automatique des transferts : colonnes additives sur transactions.
-- Purement additif. Les lignes existantes restent id_transfert NULL / is_transfert false (lignes héritées).

ALTER TABLE transactions ADD COLUMN IF NOT EXISTS id_transfert INTEGER;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_transfert BOOLEAN NOT NULL DEFAULT false;

-- Index partiel : seules les écritures de transfert portent id_transfert, donc l'index reste
-- minuscule et accélère la récupération de la paire (WHERE id_transfert = X).
CREATE INDEX IF NOT EXISTS idx_transactions_id_transfert
  ON transactions(id_transfert)
  WHERE id_transfert IS NOT NULL;
