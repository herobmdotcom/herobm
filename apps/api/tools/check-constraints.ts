import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const pool = new Pool({
  connectionString: `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
});

async function run() {
  const query = `
    SELECT table_name, column_name, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'herobm_core' 
      AND table_name IN ('customers', 'suppliers', 'products')
      AND column_name IN (
        'tax_position_id', 'trading_terms_id', 'credit_limit', 'is_on_credit_hold',
        'early_payment_discount', 'early_payment_discount_days', 'is_purchasing_blocked', 'is_payment_blocked',
        'sales_tax_category_id', 'purchase_tax_category_id'
      )
    ORDER BY table_name, column_name;
  `;
  
  try {
    const res = await pool.query(query);
    console.table(res.rows);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await pool.end();
  }
}

run();
