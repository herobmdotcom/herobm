import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as path from 'path';

require('dotenv').config({ path: '../../.env' });
const connectionString = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const migrationClient = postgres(connectionString, { max: 1 });
const db = drizzle(migrationClient);

async function run() {
  try {
    const folder = path.join(__dirname, 'migrations');
    console.log(`Running migrations from ${folder}`);
    await migrate(db, { migrationsFolder: folder });
    console.log('Migrations applied successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await migrationClient.end();
  }
}
run();
