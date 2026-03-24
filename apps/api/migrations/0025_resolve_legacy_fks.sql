-- 0025_resolve_legacy_fks.sql
-- Resolves legacy ABM text IDs in FK columns to proper UUIDs,
-- ALTERs columns from text → uuid, and adds FK constraints.
--
-- Three FK columns are affected:
--   sales_order_lines.product_id   (text → uuid, references products)
--   purchase_order_lines.product_id (text → uuid, references products)
--   purchase_orders.vendor_id       (text → uuid, references suppliers)

-- =========================================================================
-- Phase 0: Flag orphans (ABM IDs with no matching core record)
-- =========================================================================

-- Flag orphan product_ids in sales_order_lines
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM modbm_core.sales_order_lines sol
  WHERE sol.product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT EXISTS (
      SELECT 1 FROM modbm_core.products p WHERE p.source_id = sol.product_id
    );
  IF orphan_count > 0 THEN
    RAISE WARNING '[0025] % orphan product_id values in sales_order_lines (no matching core product via source_id) — will be NULLed', orphan_count;
  END IF;
END $$;

-- Flag orphan product_ids in purchase_order_lines
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM modbm_core.purchase_order_lines pol
  WHERE pol.product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT EXISTS (
      SELECT 1 FROM modbm_core.products p WHERE p.source_id = pol.product_id
    );
  IF orphan_count > 0 THEN
    RAISE WARNING '[0025] % orphan product_id values in purchase_order_lines (no matching core product via source_id) — will be NULLed', orphan_count;
  END IF;
END $$;

-- Flag orphan vendor_ids in purchase_orders
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT count(*) INTO orphan_count
  FROM modbm_core.purchase_orders po
  WHERE po.vendor_id IS NOT NULL
    AND po.vendor_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    AND NOT EXISTS (
      SELECT 1 FROM modbm_core.suppliers s WHERE s.source_id = po.vendor_id
    );
  IF orphan_count > 0 THEN
    RAISE WARNING '[0025] % orphan vendor_id values in purchase_orders (no matching core supplier via source_id) — will be NULLed', orphan_count;
  END IF;
END $$;

-- =========================================================================
-- Phase 1: Resolve legacy ABM IDs → UUIDs via source_id mapping
-- =========================================================================

-- Resolve sales_order_lines.product_id
UPDATE modbm_core.sales_order_lines sol
SET product_id = p.product_id::text
FROM modbm_core.products p
WHERE p.source_id = sol.product_id
  AND sol.product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- NULL-out orphans in sales_order_lines (unresolvable legacy IDs)
UPDATE modbm_core.sales_order_lines
SET product_id = NULL
WHERE product_id IS NOT NULL
  AND product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Resolve purchase_order_lines.product_id
UPDATE modbm_core.purchase_order_lines pol
SET product_id = p.product_id::text
FROM modbm_core.products p
WHERE p.source_id = pol.product_id
  AND pol.product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- NULL-out orphans in purchase_order_lines
UPDATE modbm_core.purchase_order_lines
SET product_id = NULL
WHERE product_id IS NOT NULL
  AND product_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Resolve purchase_orders.vendor_id
UPDATE modbm_core.purchase_orders po
SET vendor_id = s.vendor_id::text
FROM modbm_core.suppliers s
WHERE s.source_id = po.vendor_id
  AND po.vendor_id IS NOT NULL
  AND po.vendor_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- NULL-out orphans in purchase_orders (including app-created POs
-- referencing deleted suppliers)
UPDATE modbm_core.purchase_orders
SET vendor_id = NULL
WHERE vendor_id IS NOT NULL
  AND vendor_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- =========================================================================
-- Phase 2: ALTER column types from text → uuid
-- =========================================================================

ALTER TABLE modbm_core.sales_order_lines
  ALTER COLUMN product_id TYPE uuid USING product_id::uuid;

ALTER TABLE modbm_core.purchase_order_lines
  ALTER COLUMN product_id TYPE uuid USING product_id::uuid;

ALTER TABLE modbm_core.purchase_orders
  ALTER COLUMN vendor_id TYPE uuid USING vendor_id::uuid;

-- =========================================================================
-- Phase 3: NULL-out any UUID vendor_ids that point to non-existent suppliers
-- (e.g. app-created POs referencing deleted / test suppliers)
-- =========================================================================

UPDATE modbm_core.purchase_orders
SET vendor_id = NULL
WHERE vendor_id IS NOT NULL
  AND vendor_id NOT IN (SELECT vendor_id FROM modbm_core.suppliers);

-- =========================================================================
-- Phase 4: ADD FK constraints (idempotent)
-- =========================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sol_product') THEN
    ALTER TABLE modbm_core.sales_order_lines
      ADD CONSTRAINT fk_sol_product
      FOREIGN KEY (product_id) REFERENCES modbm_core.products(product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_pol_product') THEN
    ALTER TABLE modbm_core.purchase_order_lines
      ADD CONSTRAINT fk_pol_product
      FOREIGN KEY (product_id) REFERENCES modbm_core.products(product_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_po_vendor') THEN
    ALTER TABLE modbm_core.purchase_orders
      ADD CONSTRAINT fk_po_vendor
      FOREIGN KEY (vendor_id) REFERENCES modbm_core.suppliers(vendor_id);
  END IF;
END $$;
