import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({ connectionString: process.env.DATABASE_URL || 'postgres://postgres:postgres@localhost:5432/modbm_core' });
const db = drizzle(pool);

async function run() {
  try {
    const plocationsCols = await db.execute(\SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'modbm_mirror' AND table_name = 'plocations'\);
    console.log('PLOCATIONS Columns:', plocationsCols.rows);
    
    const pbinsCols = await db.execute(\SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'modbm_mirror' AND table_name = 'pbins'\);
    console.log('PBINS Columns:', pbinsCols.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
