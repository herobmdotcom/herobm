-- 0007: Create modbm_core.inventory_levels table
-- This table is app-owned inventory, mutated by order lifecycle events.
-- Data seeding is handled by tools/seed.py (not in migrations).

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
