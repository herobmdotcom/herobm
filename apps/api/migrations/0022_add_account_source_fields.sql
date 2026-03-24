-- 0022_add_account_source_fields.sql
-- Adds sourceId (upsert key for external imports), source (origin tracker),
-- and priceTier (resolved pricing tier) to modbm_core.accounts.

ALTER TABLE modbm_core.accounts ADD COLUMN IF NOT EXISTS source_id text;
ALTER TABLE modbm_core.accounts ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE modbm_core.accounts ADD COLUMN IF NOT EXISTS price_tier text;

-- Unique index for idempotent upserts by source system ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'accounts_source_id_unique'
  ) THEN
    ALTER TABLE modbm_core.accounts ADD CONSTRAINT accounts_source_id_unique UNIQUE (source_id);
  END IF;
END $$;
