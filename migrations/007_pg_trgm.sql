CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_tx_description_trgm
  ON transactions USING gin(description gin_trgm_ops);
