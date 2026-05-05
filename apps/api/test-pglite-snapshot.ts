import { PGlite } from '@electric-sql/pglite';

async function testSnapshot() {
  console.log('Starting PGlite...');
  const db1 = new PGlite();
  await db1.exec(`CREATE TABLE test (id int); INSERT INTO test VALUES (1);`);
  
  // Dump the data dir
  const dump = await db1.dumpDataDir();
  console.log('Dump type:', dump.constructor.name);
  
  console.time('boot from dump');
  const db2 = new PGlite({ loadDataDir: dump });
  await db2.waitReady;
  console.timeEnd('boot from dump');
  const res = await db2.exec(`SELECT * FROM test;`);
  console.log('Result from db2:', res[0].rows);
  
  await db1.close();
  await db2.close();
}

testSnapshot().catch(console.error);
