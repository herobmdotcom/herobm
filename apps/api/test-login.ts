import { createMemoryDb } from './test/utils/memory-db';
import * as schema from './src/drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';

async function main() {
  const { db } = await createMemoryDb();
  const users = await db.select().from(schema.users).where(eq(schema.users.username, 'admin'));
  console.log(users);
}
main().catch(console.error);
