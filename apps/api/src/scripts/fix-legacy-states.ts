import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { DrizzleDB } from '../drizzle/drizzle.module';
import { sql } from 'drizzle-orm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const db = app.get<DrizzleDB>(DRIZZLE);

  console.log('Running data cleanup script...');

  const result = await db.execute(sql`
    UPDATE modbm_core.purchase_orders 
    SET state_code = 'legacy' 
    WHERE state_code NOT IN ('draft', 'ordered', 'partially_received', 'received', 'invoiced', 'cancelled', 'legacy')
  `);

  console.log('Update result:', result);
  console.log('Cleanup complete.');

  await app.close();
}

bootstrap().catch((err) => {
  console.error('Migration script failed', err);
  process.exit(1);
});
