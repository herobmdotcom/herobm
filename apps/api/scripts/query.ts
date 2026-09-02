import 'dotenv/config';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function run() {
  const res = await pool.query('SELECT * FROM herobm_core.app_settings LIMIT 1');
  console.log(res.rows);
  await pool.end();
}

run();
