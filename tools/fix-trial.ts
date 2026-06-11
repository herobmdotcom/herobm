import * as dotenv from 'dotenv';
import * as path from 'path';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';

dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const pgUser = process.env.POSTGRES_USER || 'postgres';
  const pgPass = process.env.POSTGRES_PASSWORD;
  const pgHost = process.env.POSTGRES_HOST || 'localhost';
  const pgPort = process.env.POSTGRES_PORT || '5432';
  const pgDb = process.env.POSTGRES_DB || 'herobm';
  
  if (!pgPass) {
    console.error('No POSTGRES_PASSWORD set in .env');
    return;
  }

  const sql = postgres(`postgres://${pgUser}:${pgPass}@${pgHost}:${pgPort}/${pgDb}`);
  const now = new Date();
  const timeHex = now.getTime().toString(16).padStart(12, '0');
  const sid = `${uuidv4()}-${timeHex}`;

  await sql`
    UPDATE modbm_core.app_settings 
    SET setup_completed_at = ${now}, 
        system_identifier = ${sid}
  `;
  await sql.end();

  console.log(`Successfully synced system_identifier and setup_completed_at for ${pgDb}`);
}

main().catch(console.error);
