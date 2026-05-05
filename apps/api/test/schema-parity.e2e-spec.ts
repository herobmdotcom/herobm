import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { AppModule } from '../src/app.module';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import * as schema from '../src/drizzle/modbm-core-schema';
import { is } from 'drizzle-orm';
import { PgTable, PgView } from 'drizzle-orm/pg-core';

import { INestApplication } from '@nestjs/common';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';

describe('Database Schema Parity (e2e)', () => {
  let app: INestApplication;
  let db: NodePgDatabase<any>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (await createE2eModule()).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    db = app.get(DRIZZLE);
  });

  afterAll(async () => {
    await app.close();
  });

  it('should successfully select from all declared schema entities to ensure Postgres schema parity', async () => {
    // Drizzle table/view instances store internal configuration in `_` with a name
    const entities = Object.entries(schema)
      .map(([key, value]) => ({ key, entity: value as any }))
      .filter(({ entity }) => {
        return entity && (is(entity, PgTable) || is(entity, PgView));
      });

    expect(entities.length).toBeGreaterThan(0);

    const errors = [];

    for (const { key, entity } of entities) {
      try {
        await db.select().from(entity).limit(1);
      } catch (err: any) {
        // Collect errors instead of failing immediately to provide a comprehensive report
        errors.push(
          `[${key}] ${err.stack || err.message} CAUSE: ${err.cause ? err.cause.stack || err.cause.message : 'no cause'}`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nSchema drift detected in Postgres definitions:\n\n${errors.join('\n')}\n`,
      );
    }
  });
});
