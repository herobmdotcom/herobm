import { MockDrizzle } from '../test/utils/mock-drizzle';
import { suppliers } from './drizzle/herobm-core-schema';

test('mock drizzle behavior', async () => {
  const mockDb = new MockDrizzle();
  mockDb.onTable('suppliers', [{ vendorId: 'v1', name: 'ACME' }]);

  const [vendor] = await mockDb.select().from(suppliers).limit(1);
  console.log('Vendor:', vendor);
});
