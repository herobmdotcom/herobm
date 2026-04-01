require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const url = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const sql = postgres(url);

async function run() {
  try {
    const res = await sql`select * from modbm_core.supplier_groups limit 10`;
    console.log("SUCCESS:", res);
  } catch (err) {
    console.error("DB_ERROR_CODE:", err.code);
    console.error("DB_ERROR_MESSAGE:", err.message);
    if (err.position) console.error("POSITION:", err.position);
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
