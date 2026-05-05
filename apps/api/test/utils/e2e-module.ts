import { Test, TestingModuleBuilder } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { DRIZZLE, POSTGRES_CLIENT } from '../../src/drizzle/drizzle.module';
import { createMemoryDb } from './memory-db';

export async function createE2eModule(): Promise<TestingModuleBuilder> {
  let builder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (process.env.USE_PGLITE === 'true') {
    const memDb = await createMemoryDb();
    builder = builder
      .overrideProvider(DRIZZLE)
      .useValue(memDb.db)
      .overrideProvider(POSTGRES_CLIENT)
      .useValue({ end: async () => {} });
  }

  return builder;
}
