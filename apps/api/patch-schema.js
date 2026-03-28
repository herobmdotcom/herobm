require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const connectionString = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const sql = postgres(connectionString);

async function run() {
  try {
    console.log('Patching products table...');
    await sql`ALTER TABLE "modbm_core"."products" ADD COLUMN IF NOT EXISTS "product_type" text DEFAULT 'inventory' NOT NULL;`;
    
    console.log('Patching sales_order_lines table...');
    await sql`ALTER TABLE "modbm_core"."sales_order_lines" ADD COLUMN IF NOT EXISTS "is_post_confirmation" boolean DEFAULT false;`;
    
    console.log('Database patched successfully.');
  } catch (err) {
    console.error('Failed to patch schema:', err);
  } finally {
    process.exit(0);
  }
}
run();
