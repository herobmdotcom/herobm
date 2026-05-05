import { resolve } from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { CoaLoaderService } from '../gl/coa-loader.service';
import { Logger } from '@nestjs/common';

const dbUrl = process.env.SHADOW_DB_URL || process.env.DATABASE_URL;
const queryClient = dbUrl
  ? postgres(dbUrl)
  : postgres({
      host: process.env.POSTGRES_HOST ?? 'localhost',
      port: Number(process.env.POSTGRES_PORT ?? 5432),
      user: process.env.POSTGRES_USER,
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB ?? 'custom_app',
    });
const db = drizzle(queryClient);

// Instantiate the CoaLoaderService directly, bypassing full NestJS bootstrap
// for speed during testing and initialization.
const loader = new CoaLoaderService(db as any);

async function seed() {
  Logger.log('Seeding Chart of Accounts and GL Settings...');
  try {
    const result = await loader.loadFromFile('au_standard.json');
    if (result.skipped) {
      Logger.log('COA already seeded, skipping.');
    } else {
      Logger.log(`✅ COA seeded successfully (${result.created} accounts).`);
    }
  } catch (error) {
    Logger.error('Error seeding COA:', error);
    process.exit(1);
  } finally {
    await queryClient.end();
  }
}

void seed();
