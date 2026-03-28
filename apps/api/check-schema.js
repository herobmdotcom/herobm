require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const connectionString = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const sql = postgres(connectionString);
async function run() {
  const result = await sql`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'modbm_core' AND table_name = 'sales_order_lines';
  `;
  console.log(result);
  process.exit(0);
}
run();
