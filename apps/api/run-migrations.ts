import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const host = process.env.POSTGRES_HOST || '127.0.0.1';
const port = Number(process.env.POSTGRES_PORT) || 5432;
const user = process.env.POSTGRES_USER || 'postgres';
const password = process.env.POSTGRES_PASSWORD;
const database = process.env.POSTGRES_DB || 'herobm';

const pool = new Pool({ host, port, user, password, database });
const db = drizzle(pool);

async function main() {
  console.log('Running migrations...');
  try {
    await migrate(db, { migrationsFolder: './migrations' });
    console.log('Migrations complete');
  } catch (e) {
    console.error('Migration error:', e);
  } finally {
    await pool.end();
  }
}
main();
