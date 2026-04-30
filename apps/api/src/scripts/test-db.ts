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
  const result = await sql`SELECT template FROM reports WHERE slug = 'sales-order-quote'`;
  console.log('Exists?', result[0].template.includes('quoteIntroText'));
  process.exit(0);
}
main();
