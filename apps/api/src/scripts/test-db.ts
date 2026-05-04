import postgres from 'postgres';
import { resolve } from 'path';
process.loadEnvFile(resolve(__dirname, '../../../../.env'));
const sql = postgres({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB ?? 'custom_app',
});
async function main() {
  const result = await sql`SELECT * FROM modbm_core.payment_entries`;
  console.log('Result:', result);
  process.exit(0);
}
void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
