-- GST Categories Migration
-- Creates the gst_categories table, seeds default categories,
-- and adds gst_category_id columns to orders and lines.

BEGIN;

-- 1. Create gst_categories table
CREATE TABLE IF NOT EXISTS modbm_core.gst_categories (
  gst_category_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('not_relevant', 'exempt', 'zero_rated', 'gst_applies')),
  rate NUMERIC DEFAULT 0,
  is_default BOOLEAN DEFAULT false
);

-- 2. Seed default categories
INSERT INTO modbm_core.gst_categories (code, title, type, rate, is_default) VALUES
  ('EXE', 'Exempt Customer', 'exempt', 0, false),
  ('ZR',  'Zero Rated Products', 'zero_rated', 0, false),
  ('GST', '9% GST', 'gst_applies', 9, true)
ON CONFLICT (code) DO NOTHING;

-- 3. Add gst_category_id to sales_orders
ALTER TABLE modbm_core.sales_orders
  ADD COLUMN IF NOT EXISTS gst_category_id UUID
  REFERENCES modbm_core.gst_categories(gst_category_id);

-- 4. Add gst_category_id to sales_order_lines
ALTER TABLE modbm_core.sales_order_lines
  ADD COLUMN IF NOT EXISTS gst_category_id UUID
  REFERENCES modbm_core.gst_categories(gst_category_id);

-- 5. Backfill existing lines
-- Lines with tax > 0 get the GST category; lines with tax = 0 get Exempt
UPDATE modbm_core.sales_order_lines
SET gst_category_id = (
  SELECT gst_category_id FROM modbm_core.gst_categories WHERE code = 'GST'
)
WHERE tax::numeric > 0 AND gst_category_id IS NULL;

UPDATE modbm_core.sales_order_lines
SET gst_category_id = (
  SELECT gst_category_id FROM modbm_core.gst_categories WHERE code = 'EXE'
)
WHERE (tax IS NULL OR tax::numeric = 0) AND gst_category_id IS NULL;

-- 6. Set order-level GST from first line (best-effort backfill)
UPDATE modbm_core.sales_orders o
SET gst_category_id = (
  SELECT l.gst_category_id
  FROM modbm_core.sales_order_lines l
  WHERE l.sales_order_id = o.sales_order_id
  ORDER BY l.line_number
  LIMIT 1
)
WHERE o.gst_category_id IS NULL;

COMMIT;
