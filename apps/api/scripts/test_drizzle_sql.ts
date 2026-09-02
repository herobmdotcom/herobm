import { pgTable, integer } from 'drizzle-orm/pg-core';
import { drizzle } from 'drizzle-orm/postgres-js';

const mockTable = pgTable('mock', { id: integer('id').primaryKey() });
const db = drizzle({} as any);

const limitStr: any = "99999";
try {
  const q = db.select().from(mockTable).limit(limitStr).toSQL();
  console.log("SQL:", q);
} catch (e: any) {
  console.log("Error:", e.message);
}
