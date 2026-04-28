-- Update purchase_order_state_check to include 'archived'
ALTER TABLE modbm_core.purchase_orders DROP CONSTRAINT IF EXISTS purchase_order_state_check;
ALTER TABLE modbm_core.purchase_orders ADD CONSTRAINT purchase_order_state_check 
CHECK (state_code IN ('cancelled', 'draft', 'ordered', 'partially_received', 'received', 'invoiced', 'legacy', 'archived'));
