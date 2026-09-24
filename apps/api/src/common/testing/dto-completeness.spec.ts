import { getSchemaColumns, getDtoProperties } from './schema-parity.utils';
import * as path from 'path';

describe('Global DTO Completeness', () => {
  const mappings = [
    {
      module: 'Customers',
      schemaFile: '@herobm/db-schema',
      tableName: 'customers',
      dtoFile: '../../customers/dto.ts',
      dtoClass: 'BaseCustomerDto',
      ignoredColumns: [
        'customerId',
        'externalId',
        'sourceId',
        'source',
        'priceTier',
        'createdBy',
        'createdOn',
        'modifiedOn',
      ], // Generated/Metadata
    },
    {
      module: 'Suppliers',
      schemaFile: '@herobm/db-schema',
      tableName: 'suppliers',
      dtoFile: '../../suppliers/dto.ts',
      dtoClass: 'BaseSupplierDto',
      ignoredColumns: [
        'vendorId',
        'externalId',
        'sourceId',
        'source',
        'createdBy',
        'createdOn',
        'modifiedOn',
      ], // Generated/Metadata
    },
    {
      module: 'Products',
      schemaFile: '@herobm/db-schema',
      tableName: 'products',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'BaseProductDto',
      ignoredColumns: [
        'productId',
        'weightedAverageCost',
        'externalId',
        'sourceId',
        'source',
        'createdBy',
        'createdOn',
        'modifiedOn',
      ], // Generated/Metadata
    },
    {
      module: 'ProductGroups',
      schemaFile: '@herobm/db-schema',
      tableName: 'productGroups',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'BaseProductGroupDto',
      ignoredColumns: ['productGroupId'],
    },
    {
      module: 'ProductDefaultBins',
      schemaFile: '@herobm/db-schema',
      tableName: 'productDefaultBins',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'LinkBinDto',
      ignoredColumns: [
        'productDefaultBinId',
        'productId', // Passed in URL param
        'createdOn',
        'modifiedOn',
      ],
    },
    {
      module: 'ProductComponents',
      schemaFile: '@herobm/db-schema',
      tableName: 'productComponents',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'AddProductComponentDto',
      ignoredColumns: ['componentId', 'parentProductId'],
    },
    {
      module: 'ProductUoms',
      schemaFile: '@herobm/db-schema',
      tableName: 'productUoms',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'AddProductUomDto',
      ignoredColumns: [
        'productUomId',
        'productId',
        'isSalesDefault',
        'isPurchaseDefault',
      ],
    },
    {
      module: 'ProductSuppliers',
      schemaFile: '@herobm/db-schema',
      tableName: 'productSuppliers',
      dtoFile: '../../products/dto.ts',
      dtoClass: 'AddSupplierDto',
      ignoredColumns: [
        'productSupplierId',
        'productId',
        'discountPercent',
        'priceBreakQuantity',
        'isPreferred',
        'minPurchaseQty',
        'purchaseUnit',
        'stateCode',
        'sourceId',
        'source',
        'createdBy',
        'createdOn',
        'modifiedOn',
      ],
    },
  ];

  for (const map of mappings) {
    describe(map.module, () => {
      it(`should include all ${map.tableName} columns in ${map.dtoClass}`, () => {
        const schemaPath =
          map.schemaFile === '@herobm/db-schema'
            ? path.resolve(
                __dirname,
                '../../../../../packages/db-schema/src/index.ts',
              )
            : path.resolve(__dirname, map.schemaFile);
        const dtoPath = path.resolve(__dirname, map.dtoFile);

        const columns = getSchemaColumns(schemaPath, map.tableName);
        const dtoProps = getDtoProperties(dtoPath, map.dtoClass);

        const missing = columns.filter(
          (col) => !dtoProps.includes(col) && !map.ignoredColumns.includes(col),
        );

        // Print useful error message if missing
        if (missing.length > 0) {
          console.error(
            `Missing properties in ${map.dtoClass} for ${map.tableName} schema:`,
            missing,
          );
        }

        expect(missing).toEqual([]);
      });
    });
  }
});
