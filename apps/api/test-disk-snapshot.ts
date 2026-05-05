import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';

async function testDiskSnapshot() {
  console.log('Booting PGlite...');
  const db1 = new PGlite();
  await db1.exec(`CREATE TABLE test (id int); INSERT INTO test VALUES (1);`);
  
  console.log('Dumping to disk...');
  const dump = await db1.dumpDataDir();
  const buffer = Buffer.from(await dump.arrayBuffer());
  fs.writeFileSync('.test-snapshot.bin', buffer);
  await db1.close();

  console.log('Reading from disk...');
  const readBuffer = fs.readFileSync('.test-snapshot.bin');
  const file = new File([readBuffer], 'snapshot.tar');

  console.time('Boot from disk buffer');
  const db2 = new PGlite({ loadDataDir: file });
  await db2.waitReady;
  console.timeEnd('Boot from disk buffer');

  const res = await db2.exec(`SELECT * FROM test;`);
  console.log('Result:', res[0].rows);
  await db2.close();
}

testDiskSnapshot().catch(console.error);
