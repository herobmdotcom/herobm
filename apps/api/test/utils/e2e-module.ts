import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DRIZZLE, POSTGRES_CLIENT } from '../../src/drizzle/drizzle.module';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../../src/drizzle/modbm-core-schema';
import * as fs from 'fs';
import * as path from 'path';

export async function createE2eModule(): Promise<TestingModuleBuilder> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (process.env.USE_PGLITE === 'true') {
    const snapshotPath = path.join(process.cwd(), '.pglite-snapshot.bin');
    if (!fs.existsSync(snapshotPath)) {
      throw new Error(
        'PGlite snapshot not found. Did you forget to run generate-snapshot.ts?',
      );
    }
    const buffer = fs.readFileSync(snapshotPath);
    const suiteSnapshot = new File([buffer], 'snapshot.tar');

    const client = new PGlite({ loadDataDir: suiteSnapshot });
    await client.waitReady;
    const db = drizzle({ client, schema, casing: 'snake_case' });

    builder = builder
      .overrideProvider(DRIZZLE)
      .useValue(db)
      .overrideProvider(POSTGRES_CLIENT)
      .useValue({ end: async () => await client.close() });
  }

  return builder;
}
