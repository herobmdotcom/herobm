import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { appSettings } from './src/drizzle/modbm-core-schema';

const dbUrl = process.env.DATABASE_URL || `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;

const pool = new Pool({ connectionString: dbUrl });
const db = drizzle(pool);

async function main() {
  try {
    const [app] = await db.select().from(appSettings).limit(1);
    console.log('SUCCESS:', app);
  } catch (e) {
    console.error('DRIZZLE ERROR:', e.message);
  } finally {
    await pool.end();
  }
}

main();
