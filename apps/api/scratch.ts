import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { salesOrderReturnLines } from './src/drizzle/herobm-core-schema';
import { v4 as uuidv4 } from 'uuid';

async function main() {
  const client = new PGlite();
  const db = drizzle(client);
  const q = db.insert(salesOrderReturnLines).values({
    returnLineId: uuidv4(),
    returnId: uuidv4(),
    salesOrderLineId: uuidv4(),
    quantityReturned: '1',
    returnFee: '0',
    reason: 'Defective',
    resolution: 'refund',
    quantityReceived: '0',
    putawayStatus: 'pending',
  }).toSQL();
  console.log('Query:', q);
  process.exit(0);
}
main().catch(console.error);
