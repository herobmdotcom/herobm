import { beforeAll, afterAll } from '@jest/globals';
import { createMemoryDb } from '../../test/utils/memory-db';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import type { PGlite } from '@electric-sql/pglite';

export interface PgliteTestContext {
  readonly db: DrizzleDB;
  readonly client: PGlite;
}

/**
 * Reusable utility for PGLite testing in NestJS services.
 * Automatically handles beforeAll (initialization) and afterAll (cleanup).
 * Returns a reactive context that will be populated after beforeAll runs.
 */
export function setupPgliteSuite(opts?: {
  skipSeeds?: boolean;
}): PgliteTestContext {
  const context = {
    _db: null as any,
    _client: null as any,
    get db() {
      if (!this._db)
        throw new Error('PGLite context.db accessed before beforeAll');
      return this._db;
    },
    get client() {
      if (!this._client)
        throw new Error('PGLite context.client accessed before beforeAll');
      return this._client;
    },
  };

  beforeAll(async () => {
    const memory = await createMemoryDb(opts);
    (context as any)._db = memory.db;
    (context as any)._client = memory.client;
  });

  afterAll(async () => {
    if ((context as any)._client) {
      await (context as any)._client.close();
    }
  });

  return context as unknown as PgliteTestContext;
}
