import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DRIZZLE, POSTGRES_CLIENT } from '../../src/drizzle/drizzle.module';
// PGlite imports removed from static scope to prevent Node from evaluating
// ES modules when PGlite is not in use (avoids ERR_VM_DYNAMIC_IMPORT_CALLBACK_MISSING_FLAG)
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

    // Dynamically import PGlite only when needed
    const { PGlite } = await import('@electric-sql/pglite');
    const { drizzle: drizzlePglite } = await import('drizzle-orm/pglite');

    const client = new PGlite({ loadDataDir: suiteSnapshot });
    await client.waitReady;
    const db = drizzlePglite({ client, schema, casing: 'snake_case' } as any);

    builder = builder
      .overrideProvider(DRIZZLE)
      .useValue(db)
      .overrideProvider(POSTGRES_CLIENT)
      .useValue({ end: async () => await client.close() });
  }

  return builder;
}
