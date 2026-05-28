const fs = require('fs');
let aud = fs.readFileSync('apps/api/test/audit.e2e-spec.ts', 'utf-8');

// Insert credit note teardown before sales_order_returns
const replace1 = 'DELETE FROM modbm_core.sales_credit_note_lines WHERE credit_note_id IN (SELECT credit_note_id FROM modbm_core.sales_credit_notes WHERE return_id IN (SELECT return_id FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id));\n              DELETE FROM modbm_core.sales_credit_notes WHERE return_id IN (SELECT return_id FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id);\n              DELETE FROM modbm_core.sales_order_returns WHERE sales_order_id = r.sales_order_id;';
aud = aud.replace(/DELETE FROM modbm_core\.sales_order_returns WHERE sales_order_id = r\.sales_order_id;/g, replace1);

// Insert pick teardown before sales_order_lines
const replace2 = 'DELETE FROM modbm_core.sales_order_picks WHERE sales_order_line_id IN (SELECT sales_order_line_id FROM modbm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id);\n              DELETE FROM modbm_core.sales_order_lines WHERE sales_order_id = r.sales_order_id;';
aud = aud.replace(/DELETE FROM modbm_core\.sales_order_lines WHERE sales_order_id = r\.sales_order_id;/g, replace2);

fs.writeFileSync('apps/api/test/audit.e2e-spec.ts', aud);
console.log('Fixed audit');
