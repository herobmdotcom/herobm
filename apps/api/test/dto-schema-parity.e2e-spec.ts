import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule, OpenAPIObject } from '@nestjs/swagger';
import * as schema from '../src/drizzle/schema';

describe('DTO-Schema Reflection Parity (e2e)', () => {
  let app: INestApplication;
  let document: OpenAPIObject;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const config = new DocumentBuilder()
      .setTitle('HeroBM API')
      .setVersion('1.0')
      .build();
    document = SwaggerModule.createDocument(app, config);
  });

  afterAll(async () => {
    await app.close();
  });

  const MANUAL_MAPPING: Record<string, string> = {
    PurchaseOrderLineResponseDto: 'purchaseOrderLineItems',
    CreatePurchaseOrderLineDto: 'purchaseOrderLineItems',
    UpdatePurchaseOrderLineDto: 'purchaseOrderLineItems',
    SalesOrderLineResponseDto: 'salesOrderLineItems',
    CreateSalesOrderLineDto: 'salesOrderLineItems',
    UpdateSalesOrderLineDto: 'salesOrderLineItems',
    GoodsReceivedLineDto: 'goodsReceivedLines',
    GoodsReceivedLineResponseDto: 'goodsReceivedLines',
  };

  function guessTableName(dtoName: string): string | null {
    if (MANUAL_MAPPING[dtoName]) return MANUAL_MAPPING[dtoName];

    let base = dtoName
      .replace(/ResponseDto$/, '')
      .replace(/Dto$/, '')
      .replace(/^Create/, '')
      .replace(/^Update/, '')
      .replace(/^Partial/, '');

    if (!base) return null;

    // lowerCamelCase
    base = base.charAt(0).toLowerCase() + base.slice(1);

    // pluralize
    let table = base.endsWith('s') ? base : base + 's';
    if ((schema as Record<string, unknown>)[table]) return table;

    // try 'es'
    table = base + 'es';
    if ((schema as Record<string, unknown>)[table]) return table;

    // try 'ies'
    if (base.endsWith('y')) {
      table = base.slice(0, -1) + 'ies';
      if ((schema as Record<string, unknown>)[table]) return table;
    }

    return null;
  }

  it('should not contain fake fields in strictly typed DTOs', () => {
    const schemas = document.components?.schemas || {};
    const errors: string[] = [];
    let checkedCount = 0;
    let checkedDtos = 0;

    for (const [dtoName, dtoSchema] of Object.entries<any>(schemas)) {
      if (!dtoName.endsWith('Dto')) continue;

      const tableName = guessTableName(dtoName);
      if (!tableName) continue;

      const tableDef = (schema as Record<string, any>)[tableName];
      if (!tableDef || !tableDef._ || !tableDef._.columns) continue;

      checkedDtos++;
      const columns = tableDef._.columns;
      const properties = dtoSchema.properties || {};

      for (const [propName, propDef] of Object.entries<any>(properties)) {
        // Skip relations (arrays or objects)
        if (
          propDef.type === 'array' ||
          propDef.type === 'object' ||
          propDef.$ref
        ) {
          continue;
        }

        checkedCount++;

        // Check if property exists in DB columns
        let exists = false;

        // Drizzle columns might be snake_case in db, but camelCase in the schema object keys
        if (columns[propName]) {
          exists = true;
        } else {
          // fallback check if any column has the exact same name
          for (const col of Object.values<any>(columns)) {
            if (col.name === propName || col.key === propName) {
              exists = true;
              break;
            }
          }
        }

        if (!exists) {
          const isComputed = propDef.description?.includes('[COMPUTED]');
          if (!isComputed) {
            errors.push(
              `DTO '${dtoName}' exposes field '${propName}' which does not exist in table '${tableName}'. If this is intentional, decorate it with @ComputedMetric().`,
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nFake fields detected in DTOs:\n\n${errors.join('\n')}\n`,
      );
    }
    console.log(
      `Successfully verified ${checkedCount} fields across ${checkedDtos} mapped DTOs.`,
    );
  });
});
