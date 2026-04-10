import postgres from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const sqlClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'modbm_core',
    });

async function run() {
  try {
    const sql = fs.readFileSync(path.resolve(process.cwd(), 'src/drizzle/migrations/20260410_update_inventory_levels_view.sql'), 'utf8');
    await sqlClient.unsafe(sql);
    console.log('View updated successfully');
  } catch (err) {
    console.error('Query Error:', err);
  } finally {
    await sqlClient.end();
  }
}

run();
