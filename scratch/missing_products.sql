SELECT 
  pil.invoice_line_id, 
  pil.description, 
  pil.product_id 
FROM modbm_core.purchase_invoice_lines pil
LEFT JOIN modbm_core.products p ON pil.product_id = p.product_id
WHERE pil.product_id IS NOT NULL 
  AND p.product_id IS NULL
LIMIT 5;
