import { getSchemaColumns, getDtoProperties } from './schema-parity.utils';
import * as path from 'path';

describe('Global DTO Completeness', () => {
  const mappings = [
    {
      module: 'Customers',
      schemaFile: '../../drizzle/schema/crm.schema.ts',
      tableName: 'customers',
      dtoFile: '../../customers/dto.ts',
      dtoClass: 'BaseCustomerDto',
      ignoredColumns: ['customerId', 'externalId', 'sourceId', 'source', 'priceTier', 'createdBy', 'createdOn', 'modifiedOn'], // Generated/Metadata
    },
    {
      module: 'Suppliers',
      schemaFile: '../../drizzle/schema/crm.schema.ts',
      tableName: 'suppliers',
      dtoFile: '../../suppliers/dto.ts',
      dtoClass: 'BaseSupplierDto',
      ignoredColumns: ['vendorId', 'externalId', 'sourceId', 'source', 'createdBy', 'createdOn', 'modifiedOn'], // Generated/Metadata
    },
    {
      module: 'Products',
      schemaFile: '../../drizzle/schema/products.schema.ts',
      tableName: 'products',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'BaseProductDto',
      ignoredColumns: ['productId', 'weightedAverageCost', 'externalId', 'sourceId', 'source', 'createdBy', 'createdOn', 'modifiedOn'], // Generated/Metadata
    },
  ];

  for (const map of mappings) {
    describe(map.module, () => {
      it(`should include all ${map.tableName} columns in ${map.dtoClass}`, () => {
        const schemaPath = path.resolve(__dirname, map.schemaFile);
        const dtoPath = path.resolve(__dirname, map.dtoFile);

        const columns = getSchemaColumns(schemaPath, map.tableName);
        const dtoProps = getDtoProperties(dtoPath, map.dtoClass);

        const missing = columns.filter(col => !dtoProps.includes(col) && !map.ignoredColumns.includes(col));
        
        // Print useful error message if missing
        if (missing.length > 0) {
          console.error(`Missing properties in ${map.dtoClass} for ${map.tableName} schema:`, missing);
        }

        expect(missing).toEqual([]);
      });
    });
  }
});
