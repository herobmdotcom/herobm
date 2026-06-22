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
      ALTER TABLE "herobm_core"."suppliers" ALTER COLUMN "is_purchasing_blocked" DROP NOT NULL;
    `);
    console.log('Successfully dropped NOT NULL on suppliers.is_purchasing_blocked');
  } catch (e) {
    console.error('Error dropping NOT NULL on suppliers.is_purchasing_blocked:', e.message);
  }
  
  try {
    const res2 = await pool.query(`
      ALTER TABLE "herobm_core"."customers" ALTER COLUMN "is_on_credit_hold" DROP NOT NULL;
    `);
    console.log('Successfully dropped NOT NULL on customers.is_on_credit_hold');
  } catch (e) {
    console.error('Error dropping NOT NULL on customers.is_on_credit_hold:', e.message);
  }

  process.exit(0);
}

run();
