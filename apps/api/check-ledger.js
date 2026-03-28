require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const connectionString = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const sql = postgres(connectionString);

async function run() {
  try {
    const products = await sql`
      SELECT product_id, product_number 
      FROM modbm_core.products 
      ORDER BY created_on DESC 
      LIMIT 1
    `;
    const productId = products[0].product_id;
    console.log('Product:', products[0].product_number);
    
    const entries = await sql`
      SELECT *
      FROM modbm_core.inventory_ledger 
      WHERE product_id = ${productId}
    `;
    console.log('Entries:', entries);
  } catch (err) {
    console.error('Query failed:', err);
  } finally {
    process.exit(0);
  }
}
run();
