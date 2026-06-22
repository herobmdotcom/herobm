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
      SELECT vendor_id, vendor_number, name, early_payment_discount, early_payment_discount_days
      FROM herobm_core.suppliers
      WHERE vendor_number = 'EUROHYD'
    `);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
