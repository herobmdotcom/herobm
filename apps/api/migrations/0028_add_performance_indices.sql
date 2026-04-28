-- Add performance indices for inventory calculations
CREATE INDEX IF NOT EXISTS idx_inventory_ledger_product_location ON modbm_core.inventory_ledger(product_id, location_id);
CREATE INDEX IF NOT EXISTS idx_sales_order_lines_product_location ON modbm_core.sales_order_lines(product_id, fulfillment_location_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_lines_product ON modbm_core.purchase_order_lines(product_id);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_delivery_location ON modbm_core.purchase_orders(delivery_location_id);
CREATE INDEX IF NOT EXISTS idx_backorders_sol_state ON modbm_core.backorders(sales_order_line_id, state_code);
CREATE INDEX IF NOT EXISTS idx_backorders_product ON modbm_core.backorders(product_id);
