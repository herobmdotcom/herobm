-- 0004_add_picking.sql
-- Add per-line picking tracking and shipment document tables.

-- 1. Add quantity_picked column to existing order lines
ALTER TABLE modbm_core.sales_order_lines
  ADD COLUMN IF NOT EXISTS quantity_picked NUMERIC DEFAULT '0';

-- 2. Shipment headers (delivery batch documents)
CREATE TABLE IF NOT EXISTS modbm_core.sales_order_shipments (
  shipment_id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_number   TEXT UNIQUE NOT NULL,
  sales_order_id    UUID NOT NULL REFERENCES modbm_core.sales_orders(sales_order_id),
  state_code        TEXT NOT NULL DEFAULT 'draft',
  notes             TEXT,
  created_by        TEXT,
  created_on        TIMESTAMPTZ DEFAULT now(),
  modified_on       TIMESTAMPTZ DEFAULT now()
);

-- 3. Shipment line items (per-line quantities in each shipment)
CREATE TABLE IF NOT EXISTS modbm_core.sales_order_shipment_lines (
  shipment_line_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shipment_id         UUID NOT NULL REFERENCES modbm_core.sales_order_shipments(shipment_id),
  sales_order_line_id UUID NOT NULL REFERENCES modbm_core.sales_order_lines(sales_order_line_id),
  quantity_shipped    NUMERIC NOT NULL
);
