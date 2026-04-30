SELECT constraint_name 
FROM information_schema.table_constraints 
WHERE table_schema='modbm_core' 
  AND table_name='purchase_invoice_lines' 
  AND constraint_type='FOREIGN KEY';
