import { config } from 'dotenv';
config({ path: '../../.env' });

import { validate } from 'class-validator';
import { UpdateAccountDto } from './src/customers/dto';
import { customers } from './src/drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

async function run() {
  const queryClient = postgres(process.env.DATABASE_URL!);
  const database = drizzle(queryClient);

  const rows = await database
    .select()
    .from(customers)
    .where(eq(customers.customerId, '0873069b-e486-4229-85ce-4bbc52c005a2'))
    .limit(1);

  if (rows.length === 0) {
    console.log('Customer not found');
    process.exit(1);
  }

  console.log('API representation would map these Drizzle fields directly:');
  console.log('emailAddress1:', JSON.stringify(rows[0].emailAddress1));
  console.log('primaryContactEmail:', JSON.stringify(rows[0].primaryContactEmail));

  const dto = new UpdateAccountDto();
  // Simulate the frontend sending the EXACT object it received
  Object.assign(dto, rows[0]);
  
  const errors = await validate(dto);
  console.log('Validation errors:', errors.map(e => e.constraints));
  
  process.exit(0);
}

run();
