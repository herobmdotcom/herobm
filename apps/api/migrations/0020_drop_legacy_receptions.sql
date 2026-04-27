-- Migration: Drop legacy PO-scoped reception tables
-- These are replaced by goods_received / goods_received_lines (0019)
-- No data to preserve.

ALTER TABLE IF EXISTS modbm_core.purchase_order_reception_lines
  DROP CONSTRAINT IF EXISTS purchase_order_reception_lines_reception_id_purchase_order_receptions_reception_id_fk;
ALTER TABLE IF EXISTS modbm_core.purchase_order_reception_lines
  DROP CONSTRAINT IF EXISTS purchase_order_reception_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk;
ALTER TABLE IF EXISTS modbm_core.purchase_order_receptions
  DROP CONSTRAINT IF EXISTS purchase_order_receptions_purchase_order_id_purchase_orders_purchase_order_id_fk;

DROP TABLE IF EXISTS modbm_core.purchase_order_reception_lines;
DROP TABLE IF EXISTS modbm_core.purchase_order_receptions;
