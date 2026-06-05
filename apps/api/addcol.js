const postgres = require('postgres');
require('dotenv').config({ path: '../../.env' });

const sql = postgres(`postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'herobm'}`);

async function run() {
  try {
    await sql`ALTER TABLE "modbm_core"."products" ADD COLUMN "alternate_product_number" text`;
    console.log('column added');
  } catch (e) {
    console.log('column add failed or already done', e.message);
  }
  await sql.end();
}
run();
