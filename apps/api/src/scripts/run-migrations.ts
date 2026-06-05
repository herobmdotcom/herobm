import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const connectionString = process.env.DATABASE_URL as string;

const migrationClient = postgres(connectionString, { max: 1 });

async function runMigrations() {
  const db = drizzle(migrationClient);
  console.log('Running migrations...');
  await migrate(db, {
    migrationsFolder: path.resolve(__dirname, '../../migrations'),
  });
  console.log('Migrations complete!');
  await migrationClient.end();
}

runMigrations().catch((err) => {
  console.error('Migration failed!', err);
  process.exit(1);
});
