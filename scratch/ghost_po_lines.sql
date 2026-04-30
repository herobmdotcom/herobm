SELECT 
  pil.invoice_line_id, 
  pil.invoice_id, 
  pil.purchase_order_line_id, 
  pil.description, 
  pil.quantity_invoiced 
FROM modbm_core.purchase_invoice_lines pil
LEFT JOIN modbm_core.purchase_order_lines pol ON pil.purchase_order_line_id = pol.purchase_order_line_id
WHERE pil.purchase_order_line_id IS NOT NULL 
  AND pol.purchase_order_line_id IS NULL
LIMIT 5;
