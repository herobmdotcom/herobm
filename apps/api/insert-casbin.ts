import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { casbinRule } from './src/drizzle/modbm-core-schema';

const client = postgres(process.env.DATABASE_URL as string);
const db = drizzle(client);

async function run() {
  try {
    await db.insert(casbinRule).values([
      { ptype: 'p', v0: 'viewer', v1: 'business_report', v2: 'read', v3: 'allow' },
      { ptype: 'p', v0: 'admin', v1: 'business_report', v2: 'read', v3: 'allow' },
      { ptype: 'p', v0: 'admin', v1: 'business_report', v2: 'write', v3: 'allow' },
      { ptype: 'p', v0: 'admin', v1: 'business_report', v2: 'archive', v3: 'allow' },
    ]).execute();
    console.log('Permissions injected');
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}
run();
