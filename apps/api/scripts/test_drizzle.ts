import { config } from 'dotenv';
config({ path: '../../.env' });

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, sql } from 'drizzle-orm';
import * as schema from '../src/drizzle/herobm-core-schema.js';

const sqlClient = postgres(process.env.DATABASE_URL!);
const db = drizzle(sqlClient, { schema });

async function main() {
  const vendorId = 'c1aec841-d91f-4839-a22e-ce80535de40d'; // Use any vendor from earlier output
  let limit: any = "99999";
  
  // Try limit as a string to see what Drizzle does
  const baseQuery = db
      .select({ productSupplierId: schema.productSuppliers.productSupplierId })
      .from(schema.productSuppliers)
      .innerJoin(schema.products, eq(schema.productSuppliers.productId, schema.products.productId))
      .where(eq(schema.productSuppliers.vendorId, vendorId))
      .limit(limit)
      .offset(0);
      
  const sqlString = baseQuery.toSQL();
  console.log("SQL generated:", sqlString);
  
  try {
    const res = await baseQuery;
    console.log("Returned rows:", res.length);
  } catch (e) {
    console.error("Error executing query:", e);
  }
  
  process.exit(0);
}

main();
