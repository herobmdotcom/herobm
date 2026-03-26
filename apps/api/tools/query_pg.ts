import postgres from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';

// Fix path resolution for dotenv to support being run from anywhere
dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const input = process.argv[2];

if (!input) {
  console.error("Usage: npx tsx tools/query_pg.ts <query_string_or_file.sql>");
  process.exit(1);
}

let sql = input;
if (fs.existsSync(input)) {
  sql = fs.readFileSync(input, 'utf8');
}

const sqlClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'postgres',
      database: process.env.POSTGRES_DB || 'modbm_core',
    });

async function run() {
  try {
    const rows = await sqlClient.unsafe(sql);
    if (rows && rows.length > 0) {
      console.table(rows);
      
      const tmpPath = path.resolve(process.cwd(), '../../tmp/pg_query_out.json');
      fs.writeFileSync(tmpPath, JSON.stringify(rows, null, 2), 'utf8');
      console.log(`\n📄 Dumped raw JSON output to: ${tmpPath}`);
    } else {
      console.log('Query executed successfully (no rows returned).');
    }
  } catch (err) {
    console.error('Query Error:', err);
  } finally {
    await sqlClient.end();
  }
}

run();
