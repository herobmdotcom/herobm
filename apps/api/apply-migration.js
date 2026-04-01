require('dotenv').config({ path: '../../.env' });
const postgres = require('postgres');
const fs = require('fs');
const url = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
const sql = postgres(url);

async function run() {
  try {
    const migration = fs.readFileSync('migrations/0002_cynical_quicksilver.sql', 'utf8');
    const statements = migration.split('--> statement-breakpoint').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      console.log('Executing:', stmt);
      await sql.unsafe(stmt);
    }
    console.log("SUCCESS: MIGRATION APPLIED");
  } catch (err) {
    console.error("DB_ERROR_MESSAGE:", err.message);
    console.error(err);
  } finally {
    process.exit(0);
  }
}

run();
