import { PGlite } from '@electric-sql/pglite';
import * as fs from 'fs';
import * as path from 'path';

async function test() {
  console.log('Starting PGLite...');
  const start = Date.now();
  const client = new PGlite();
  console.log(`PGLite started in ${Date.now() - start}ms`);

  const migrationsDir = path.join(process.cwd(), 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const mStart = Date.now();
    let sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    sql = sql.replace(/^\uFEFF/, '');
    try {
      await client.exec(sql);
      console.log(`Migration ${file} finished in ${Date.now() - mStart}ms`);
    } catch (e) {
      console.error(`Migration ${file} FAILED in ${Date.now() - mStart}ms: ${e.message}`);
    }
  }
  console.log(`Total time: ${Date.now() - start}ms`);
}

test();
