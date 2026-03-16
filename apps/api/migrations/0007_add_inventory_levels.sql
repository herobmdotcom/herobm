-- 0007: Create modbm_core.inventory_levels table and seed from mart_inventory
-- This table is app-owned inventory, mutated by order lifecycle events.

CREATE TABLE IF NOT EXISTS modbm_core.inventory_levels (
  inventory_level_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id         TEXT NOT NULL,
  location_no        TEXT NOT NULL DEFAULT 'MAIN',
  quantity_on_hand   NUMERIC NOT NULL DEFAULT 0,
  quantity_committed NUMERIC NOT NULL DEFAULT 0,
  quantity_on_order  NUMERIC NOT NULL DEFAULT 0,
  modified_on        TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id, location_no)
);

-- Seed from mart_inventory (one-time snapshot of ABM data)
INSERT INTO modbm_core.inventory_levels (
  product_id,
  location_no,
  quantity_on_hand,
  quantity_committed,
  quantity_on_order,
  modified_on
)
SELECT
  product_id,
  COALESCE(location_no, 'MAIN'),
  COALESCE(quantity_on_hand::numeric, 0),
  COALESCE(quantity_committed::numeric, 0),
  COALESCE(quantity_on_order::numeric, 0),
  NOW()
FROM public_marts.mart_inventory
WHERE product_id IS NOT NULL
ON CONFLICT (product_id, location_no) DO NOTHING;
