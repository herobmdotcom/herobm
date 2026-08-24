import postgres from 'postgres';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import path from 'path';

// Fix path resolution for dotenv to support being run from anywhere
const rootDir = path.resolve(process.cwd(), process.cwd().endsWith('apps\\api') || process.cwd().endsWith('apps/api') ? '..' : '.');
let activeProfile = '';
if (fs.existsSync(path.resolve(rootDir, '.active_profile'))) {
  activeProfile = fs.readFileSync(path.resolve(rootDir, '.active_profile'), 'utf8').trim();
}
const possibleEnvFiles = [
  activeProfile ? `.env.${activeProfile}` : '',
  '.env',
  '.env.local'
].filter(Boolean);
for (const envFile of possibleEnvFiles) {
  const fullPath = path.resolve(rootDir, envFile);
  if (fs.existsSync(fullPath)) {
    dotenv.config({ path: fullPath });
    break;
  }
}

const input = process.argv[2];

if (!input) {
  console.error("Usage: npx tsx tools/query_pg.ts <query_string_or_file.sql>");
  process.exit(1);
}

let sql = input;
const querySqlInRoot = path.resolve(rootDir, 'tmp', 'query.sql');
if ((input.includes('query.sql') || input.includes('tmp')) && fs.existsSync(querySqlInRoot)) {
  sql = fs.readFileSync(querySqlInRoot, 'utf8');
  console.log(`[query_pg] Loaded from querySqlInRoot: ${querySqlInRoot} (${sql.length} chars)`);
} else if (fs.existsSync(input) && fs.statSync(input).isFile()) {
  sql = fs.readFileSync(input, 'utf8');
  console.log(`[query_pg] Loaded from input: ${input} (${sql.length} chars)`);
} else if (fs.existsSync(path.resolve(rootDir, input)) && fs.statSync(path.resolve(rootDir, input)).isFile()) {
  sql = fs.readFileSync(path.resolve(rootDir, input), 'utf8');
  console.log(`[query_pg] Loaded from rootDir/input: ${path.resolve(rootDir, input)} (${sql.length} chars)`);
}

// Security: Prevent agents from bypassing make migrate or corrupting data natively
const isSafeQuery = /^\s*(SELECT|WITH|EXPLAIN|SHOW)\b/i.test(sql);
if (!isSafeQuery) {
  console.error("ERROR: The tools/query_pg.ts utility is strictly for READ-ONLY queries (SELECT, WITH, EXPLAIN).");
  console.error("If you are an agent attempting to modify the schema (CREATE, ALTER, DROP) or data (INSERT, UPDATE, DELETE), you are VIOLATING the Constitution.");
  console.error("MANDATED: You must use Drizzle schema updates and 'make migrate', or 'tools/seed.py' for data testing.");
  process.exit(1);
}

const sqlClient = process.env.DATABASE_URL
  ? postgres(process.env.DATABASE_URL, { max: 1 })
  : postgres({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT || 5432),
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD,
      database: process.env.TARGET_DB || process.env.POSTGRES_DB || 'herobm',
      max: 1,
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
