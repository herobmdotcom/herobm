import * as schema from './apps/api/src/drizzle/modbm-core-schema';
import { getTableConfig } from 'drizzle-orm/pg-core';

function getUniques(table) {
  const config = getTableConfig(table);
  return config.uniqueConstraints.map(c => c.name) || [];
}
console.log('customers', getUniques(schema.customers));
console.log('products', getUniques(schema.products));
