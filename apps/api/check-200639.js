require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const connectionString = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const sql = postgres(connectionString);

async function run() {
  try {
    const products = await sql`
      SELECT product_id, product_number, name, quantity_on_hand
      FROM modbm_core.products 
      WHERE product_number = '200639'
      LIMIT 1
    `;
    const productId = products[0].product_id;
    console.log('Product:', products[0]);
    
    const byLoc = await sql`
      SELECT location_id, SUM(quantity) as sum_qty
      FROM modbm_core.inventory_ledger 
      WHERE product_id = ${productId}
      GROUP BY location_id
    `;
    console.log('Ledger By Location:', byLoc);
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    process.exit(0);
  }
}
run();
