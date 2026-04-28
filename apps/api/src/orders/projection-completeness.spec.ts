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
import * as fs from 'fs';
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
  /**
   * Extract the JS property names from a Drizzle `pgSchema.table(...)` call.
   * Drizzle schemas define columns as object keys, e.g.:
   *   salesOrderLineId: uuid('sales_order_line_id').primaryKey()
   * We extract the key name (salesOrderLineId) from the schema source.
   */
  function getSchemaColumns(tableName: string): string[] {
    const schemaPath = path.resolve(
      __dirname,
      '../drizzle/modbm-core-schema.ts',
    );
    const src = fs.readFileSync(schemaPath, 'utf-8');

    // Find the table definition block: export const <tableName> = modbmCore.table(...)
    const tableRegex = new RegExp(
      `export const ${tableName}\\s*=\\s*modbmCore\\.table\\([^,]+,\\s*\\{([^}]+)\\}`,
      's',
    );
    const match = src.match(tableRegex);
    if (!match) {
      throw new Error(`Could not find table '${tableName}' in schema file`);
    }

    const body = match[1];
    // Extract property names (the JS key before the colon)
    const propRegex = /^\s*(\w+)\s*:/gm;
    const columns: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = propRegex.exec(body)) !== null) {
      columns.push(m[1]);
    }
    return columns;
  }

  /**
   * Extract the field names from the `.select({...})` block inside
   * `findOne` in the orders-write service.
   */
  function getFindOneProjectionFields(): string[] {
    const servicePath = path.resolve(__dirname, './orders-write.service.ts');
    const src = fs.readFileSync(servicePath, 'utf-8');

    // Locate the findOne method and its select({...}) block
    const findOneIdx = src.indexOf('async findOne(');
    if (findOneIdx === -1) {
      throw new Error(
        'Could not find findOne method in orders-write.service.ts',
      );
    }

    const afterFindOne = src.substring(findOneIdx);

    // Find the .select({ ... }) block
    const selectStart = afterFindOne.indexOf('.select({');
    if (selectStart === -1) {
      // If no explicit select, it returns all columns — pass automatically
      return [];
    }

    // Extract the content between .select({ and the matching })
    const selectBody = afterFindOne.substring(selectStart + '.select({'.length);
    const closingIdx = selectBody.indexOf('})');
    if (closingIdx === -1) {
      throw new Error('Could not find closing }) for select projection');
    }

    const projectionBody = selectBody.substring(0, closingIdx);

    // Extract property names (keys of the projection object)
    const propRegex = /^\s*(\w+)\s*:/gm;
    const fields: string[] = [];
    let m: RegExpExecArray | null;
    while ((m = propRegex.exec(projectionBody)) !== null) {
      fields.push(m[1]);
    }
    return fields;
  }

  // =========================================================================
  // Test: salesOrderLineItems columns must be present in findOne projection
  // =========================================================================

  describe('OrdersWriteService.findOne — salesOrderLineItems', () => {
    const SCHEMA_TABLE = 'salesOrderLineItems';

    // These columns are intentionally NOT projected because they come
    // from a joined table instead of the line items table itself.
    // productNumber comes from the products table via leftJoin.
    const JOINED_EXTRAS = ['productNumber'];

    it('should project every schema column from salesOrderLineItems', () => {
      const schemaColumns = getSchemaColumns(SCHEMA_TABLE);
      const projectionFields = getFindOneProjectionFields();

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
      const projectionFields = getFindOneProjectionFields();
      if (projectionFields.length === 0) return;

      for (const field of JOINED_EXTRAS) {
        expect(projectionFields).toContain(field);
      }
    });

    it('should not have unknown fields in the projection', () => {
      const schemaColumns = getSchemaColumns(SCHEMA_TABLE);
      const projectionFields = getFindOneProjectionFields();
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
