import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({
  path: path.join(process.cwd(), '..', '..', process.env.ENV_FILE || '.env'),
});

import { createMemoryDb } from '../../test/utils/memory-db';
import * as fs from 'fs';

async function generateSnapshot() {
  if (process.env.USE_PGLITE !== 'true') {
    return;
  }

  console.log('[PGlite Cache] Generating global snapshots...');
  const apiDir = fs.existsSync(path.join(process.cwd(), 'apps/api'))
    ? path.join(process.cwd(), 'apps/api')
    : path.resolve(__dirname, '../..');
  const snapshotPath = path.join(apiDir, '.pglite-snapshot.bin');
  const snapshotNoSeedPath = path.join(apiDir, '.pglite-snapshot-noseed.bin');

  const t0 = performance.now();
  const memory = await createMemoryDb();
  const dump = await memory.client.dumpDataDir();
  const buffer = Buffer.from(await dump.arrayBuffer());
  fs.writeFileSync(snapshotPath, buffer);
  await memory.client.close();

  const memoryNoSeed = await createMemoryDb({ skipSeeds: true });
  const dumpNoSeed = await memoryNoSeed.client.dumpDataDir();
  const bufferNoSeed = Buffer.from(await dumpNoSeed.arrayBuffer());
  fs.writeFileSync(snapshotNoSeedPath, bufferNoSeed);
  await memoryNoSeed.client.close();

  const t1 = performance.now();

  console.log(
    `[PGlite Cache] Global snapshots generated to ${apiDir} in ${Math.round(t1 - t0)}ms`,
  );
}

generateSnapshot().catch((err) => {
  console.error('[PGlite Cache] Snapshot generation failed:', err);
  process.exit(1);
});
