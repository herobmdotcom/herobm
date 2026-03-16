-- Add optional tracking number to shipments
ALTER TABLE modbm_core.sales_order_shipments
  ADD COLUMN tracking_number TEXT;
