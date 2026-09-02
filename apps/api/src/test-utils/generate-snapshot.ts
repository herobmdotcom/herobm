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

  console.log('[PGlite Cache] Generating global snapshot...');
  const snapshotPath = fs.existsSync(path.join(process.cwd(), 'apps/api'))
    ? path.join(process.cwd(), 'apps/api/.pglite-snapshot.bin')
    : path.resolve(__dirname, '../../.pglite-snapshot.bin');

  const t0 = performance.now();
  const memory = await createMemoryDb();
  const dump = await memory.client.dumpDataDir();
  const buffer = Buffer.from(await dump.arrayBuffer());
  fs.writeFileSync(snapshotPath, buffer);
  await memory.client.close();
  const t1 = performance.now();

  console.log(
    `[PGlite Cache] Global snapshot generated to ${snapshotPath} in ${Math.round(t1 - t0)}ms`,
  );
}

generateSnapshot().catch((err) => {
  console.error('[PGlite Cache] Snapshot generation failed:', err);
  process.exit(1);
});
