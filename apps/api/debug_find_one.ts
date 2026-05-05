import { createMemoryDb } from './test/utils/memory-db';
import { salesInvoices, salesOrders, accounts } from './src/drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';

async function test() {
  const { db, client } = await createMemoryDb({ skipSeeds: true });
  try {
    const invoiceId = '00000000-0000-0000-0000-000000000888';
    console.log('Running query...');
    const rows = await db
      .select()
      .from(salesInvoices)
      .innerJoin(
        salesOrders,
        eq(salesInvoices.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
      .where(eq(salesInvoices.invoiceId, invoiceId))
      .limit(1);
    console.log('Rows:', rows);
  } catch (err: any) {
    console.error('Error:', err);
    if (err.cause) {
      console.error('Cause:', err.cause);
    }
  } finally {
    await client.close();
  }
}

test();
