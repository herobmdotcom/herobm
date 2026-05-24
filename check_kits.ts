import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool);
async function run() {
  const res = await db.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'raw_abm' AND table_name = 'productkits'");
  console.log(res.rows);
  process.exit(0);
}
run();