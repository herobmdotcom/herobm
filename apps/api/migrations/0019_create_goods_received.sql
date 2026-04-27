-- Migration: Replace legacy purchase_order_receptions with goods_received
-- Purpose: Dock manifest for the new goods reception flow (packing slip based)
-- Step 1: Drop legacy PO-scoped reception tables (no data to preserve)

ALTER TABLE modbm_core.purchase_order_reception_lines
  DROP CONSTRAINT IF EXISTS purchase_order_reception_lines_reception_id_purchase_order_receptions_reception_id_fk;
ALTER TABLE modbm_core.purchase_order_reception_lines
  DROP CONSTRAINT IF EXISTS purchase_order_reception_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk;
ALTER TABLE modbm_core.purchase_order_receptions
  DROP CONSTRAINT IF EXISTS purchase_order_receptions_purchase_order_id_purchase_orders_purchase_order_id_fk;

DROP TABLE IF EXISTS modbm_core.purchase_order_reception_lines;
DROP TABLE IF EXISTS modbm_core.purchase_order_receptions;

-- Step 2: Create replacement tables

CREATE TABLE IF NOT EXISTS modbm_core.goods_received (
  goods_received_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT UNIQUE NOT NULL,
  vendor_id UUID NOT NULL REFERENCES modbm_core.suppliers(vendor_id),
  location_id UUID NOT NULL REFERENCES modbm_core.locations(location_id),
  packing_slip_number TEXT,
  notes TEXT,
  state_code TEXT NOT NULL DEFAULT 'received',
  created_by TEXT,
  created_on TIMESTAMPTZ DEFAULT now(),
  modified_on TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modbm_core.goods_received_lines (
  goods_received_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goods_received_id UUID NOT NULL REFERENCES modbm_core.goods_received(goods_received_id),
  product_id UUID NOT NULL REFERENCES modbm_core.products(product_id),
  quantity_received NUMERIC NOT NULL,
  match_status TEXT NOT NULL DEFAULT 'unmatched',
  purchase_order_line_id UUID REFERENCES modbm_core.purchase_order_lines(purchase_order_line_id),
  purchase_order_id UUID REFERENCES modbm_core.purchase_orders(purchase_order_id)
);
