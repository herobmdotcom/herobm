import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
});

async function run() {
  try {
    const res = await pool.query(`
      SELECT supplier_group_id, name, early_payment_discount, early_payment_discount_days
      FROM herobm_core.supplier_groups
      WHERE supplier_group_id = '37a97834-d802-40d3-9191-149b2539698c'
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
