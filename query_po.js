const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/modbm' });
pool.query(`
  SELECT po.state_code, po.vendor_id, pol.quantity, pol.quantity_received, pol.product_id 
  FROM purchase_orders po 
  JOIN purchase_order_lines pol ON po.purchase_order_id = pol.purchase_order_id 
  WHERE po.purchase_order_id = 'de0aaf66-6051-4df0-bc95-9e30791edba4'
`).then(res => { console.log(res.rows); pool.end(); });
