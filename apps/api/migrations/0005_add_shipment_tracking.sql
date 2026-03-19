-- Add optional tracking number to shipments
ALTER TABLE modbm_core.sales_order_shipments
  ADD COLUMN IF NOT EXISTS tracking_number TEXT;

