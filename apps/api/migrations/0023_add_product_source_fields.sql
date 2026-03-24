-- 0023_add_product_source_fields.sql
-- Adds product_group_name, gst_category, sc_number, source, source_id
-- to modbm_core.products for mart-to-core migration.

ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS product_group_name text;
ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS gst_category text;
ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS sc_number text;
ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'app';
ALTER TABLE modbm_core.products ADD COLUMN IF NOT EXISTS source_id text;

-- Unique index for idempotent upserts by ABM product ID
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'products_source_id_unique'
  ) THEN
    ALTER TABLE modbm_core.products ADD CONSTRAINT products_source_id_unique UNIQUE (source_id);
  END IF;
END $$;
