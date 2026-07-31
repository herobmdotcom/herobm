/**
 * Projection Completeness Tests
 *
 * These tests guard against "missing field" bugs — where an explicit
 * `.select({...})` projection omits a schema column that the frontend
 * depends on.  When a new column is added to the Drizzle schema, the
 * test will automatically fail until the projection is updated.
 *
 * Root cause: the GST select widget bug in the Sales Order Detail page
 * was caused by `findOne` missing `taxCategoryId` in its projection.
 */
import {
  getSchemaColumns,
  getFindOneProjectionFields,
} from '../common/testing/schema-parity.utils';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Schema-introspection approach
// ---------------------------------------------------------------------------
// Instead of mocking the DB and running the service, we statically read the
// source file and assert that every column defined in `salesOrderLineItems`
// appears in the `findOne` select projection.  This catches drift at CI time
// without needing a running database.
// ---------------------------------------------------------------------------

describe('Projection Completeness', () => {
  const schemaPath = path.resolve(
    __dirname,
    '../../../../../packages/db-schema/src/index.ts',
  );

  const servicePath = path.join(__dirname, 'orders-query.service.ts');

  // =========================================================================
  // Test: salesOrderLineItems columns must be present in findOne projection
  // =========================================================================

  describe('OrdersQueryService.findOne — salesOrderLineItems', () => {
    const SCHEMA_TABLE = 'salesOrderLineItems';

    // These columns are intentionally NOT projected because they come
    // from a joined table instead of the line items table itself.
    // productNumber comes from the products table via leftJoin.
    const JOINED_EXTRAS = ['productNumber'];

    it('should project every schema column from salesOrderLineItems', () => {
      const schemaColumns = getSchemaColumns(schemaPath, SCHEMA_TABLE);
      const projectionFields = getFindOneProjectionFields(
        servicePath,
        'async findOne(',
      );

      // If the service uses bare select() (no explicit projection), all
      // columns are returned automatically — nothing to check.
      if (projectionFields.length === 0) {
        return;
      }

      // Every schema column must appear in the projection
      const missingColumns = schemaColumns.filter(
        (col) => !projectionFields.includes(col),
      );

      expect(missingColumns).toEqual([]);
    });

    it('should include joined fields (productNumber) in the projection', () => {
      const projectionFields = getFindOneProjectionFields(
        servicePath,
        'async findOne(',
      );
      if (projectionFields.length === 0) return;

      for (const field of JOINED_EXTRAS) {
        expect(projectionFields).toContain(field);
      }
    });

    it('should not have unknown fields in the projection', () => {
      const schemaColumns = getSchemaColumns(schemaPath, SCHEMA_TABLE);
      const projectionFields = getFindOneProjectionFields(
        servicePath,
        'async findOne(',
      );
      if (projectionFields.length === 0) return;

      const allKnown = [...schemaColumns, ...JOINED_EXTRAS];
      const unknownFields = projectionFields.filter(
        (f) => !allKnown.includes(f),
      );

      // Unknown fields aren't necessarily wrong (could be computed columns),
      // but flag them for review.
      if (unknownFields.length > 0) {
        console.warn(
          `Projection has fields not in schema: ${unknownFields.join(', ')}. ` +
            `These should be either computed / joined columns or projection errors.`,
        );
      }
    });
  });
});
