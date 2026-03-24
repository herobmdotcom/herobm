-- 0024_add_supplier_source_fields.sql
-- Adds vendor_group, source, source_id to modbm_core.suppliers
-- for mart-to-core migration.

ALTER TABLE modbm_core.suppliers ADD COLUMN IF NOT EXISTS vendor_group text;
ALTER TABLE modbm_core.suppliers ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE modbm_core.suppliers ADD COLUMN IF NOT EXISTS source_id text;

-- Unique index for idempotent upserts by ABM vendor ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'suppliers_source_id_unique'
  ) THEN
    ALTER TABLE modbm_core.suppliers ADD CONSTRAINT suppliers_source_id_unique UNIQUE (source_id);
  END IF;
END $$;
