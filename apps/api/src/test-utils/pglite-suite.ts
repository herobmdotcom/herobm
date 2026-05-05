import { beforeAll, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import { createMemoryDb } from '../../test/utils/memory-db';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../drizzle/modbm-core-schema';

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
  // Increase timeout for PGLite suites as initialization (migrations + seeds) can be slow
  if (typeof jest !== 'undefined') {
    jest.setTimeout(30000);
  }
  const context = {
    _db: null as any,
    _client: null as any,
    get db() {
      if (!this._db)
        throw new Error('PGLite context.db accessed before it is initialized');
      return this._db;
    },
    get client() {
      if (!this._client)
        throw new Error(
          'PGLite context.client accessed before it is initialized',
        );
      return this._client;
    },
  };

  let suiteSnapshot: any;

  beforeAll(async () => {
    if (opts?.skipSeeds) {
      const memory = await createMemoryDb(opts);
      suiteSnapshot = await memory.client.dumpDataDir();
      await memory.client.close();
    } else {
      const snapshotPath = path.join(process.cwd(), '.pglite-snapshot.bin');
      if (!fs.existsSync(snapshotPath)) {
        throw new Error(
          'PGlite snapshot not found. Did you forget to run generate-snapshot.ts?',
        );
      }
      const buffer = fs.readFileSync(snapshotPath);
      suiteSnapshot = new File([buffer], 'snapshot.tar');
    }
  });

  beforeEach(async () => {
    const client = new PGlite({ loadDataDir: suiteSnapshot });
    await client.waitReady;
    const db = drizzle(client, { schema });
    context._db = db;
    context._client = client;
  });

  afterEach(async () => {
    if (context._client) {
      await context._client.close();
    }
    context._db = null;
    context._client = null;
  });

  return context as unknown as PgliteTestContext;
}
