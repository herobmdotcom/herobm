import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as fs from 'fs';
import path from 'path';
import * as dotenv from 'dotenv';
import url from 'url';

dotenv.config({ path: path.resolve(process.cwd(), '../../.env') });

const scriptPath = process.argv[2];

if (!scriptPath || !fs.existsSync(scriptPath)) {
  console.error("Usage: npx tsx tools/query_drizzle.ts <path_to_script.ts>");
  console.error("The script must export a default async function that accepts (db, schema).");
  process.exit(1);
}

const sqlClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL)
  : postgres({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.POSTGRES_DB || 'modbm_core',
    });
const db = drizzle(sqlClient);

async function run() {
  try {
    const resolvedPath = path.resolve(scriptPath);
    const fileUrl = url.pathToFileURL(resolvedPath).href;
    const module = await import(fileUrl);
    
    if (typeof module.default !== 'function') {
      console.error("Error: Target script must export a default function.");
      return;
    }
    
    const schemaFileUrl = url.pathToFileURL(path.resolve(process.cwd(), 'src/drizzle/modbm-core-schema.ts')).href;
    const schema = await import(schemaFileUrl);
    
    const result = await module.default(db, schema);
    if (result) {
      console.log(JSON.stringify(result, null, 2));
      
      const tmpPath = path.resolve(process.cwd(), '../../tmp/drizzle_query_out.json');
      fs.writeFileSync(tmpPath, JSON.stringify(result, null, 2), 'utf8');
      console.log(`\n📄 Dumped raw JSON output to: ${tmpPath}`);
    } else {
      console.log("Query executed successfully (no output returned).");
    }
  } catch (err) {
    console.error('Drizzle Execution Error:', err);
  } finally {
    await sqlClient.end();
  }
}

run();
