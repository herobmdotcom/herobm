const postgres = require('postgres');
require('dotenv').config({ path: '../../.env' });

const sql = postgres(`postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST || 'localhost'}:${process.env.POSTGRES_PORT || '5432'}/${process.env.POSTGRES_DB || 'herobm'}`);

async function run() {
  try {
    await sql`ALTER TABLE "modbm_core"."accounts" RENAME COLUMN "erpnext_id" TO "external_id"`;
    console.log('accounts renamed');
  } catch (e) {
    console.log('accounts rename failed or already done', e.message);
  }

  try {
    await sql`ALTER TABLE "modbm_core"."suppliers" RENAME COLUMN "erpnext_id" TO "external_id"`;
    console.log('suppliers renamed');
  } catch (e) {
    console.log('suppliers rename failed or already done', e.message);
  }

  try {
    await sql`ALTER TABLE "public"."journal_entries" RENAME COLUMN "erpnext_journal_id" TO "external_journal_id"`;
    console.log('journal_entries renamed');
  } catch (e) {
    console.log('journal entries rename failed or already done', e.message);
  }

  await sql.end();
}
run();
