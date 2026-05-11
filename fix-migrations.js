const { Client } = require('pg');
const fs = require('fs');

const env = fs.readFileSync('.env', 'utf-8');
const lines = env.split('\n');
const getEnv = (key) => {
  const line = lines.find(l => l.startsWith(key + '='));
  return line ? line.split('=')[1].trim() : undefined;
};

const user = getEnv('POSTGRES_USER') || 'postgres';
const pass = getEnv('POSTGRES_PASSWORD');
const host = getEnv('POSTGRES_HOST') || 'localhost';
const port = getEnv('POSTGRES_PORT') || '5432';
const db = getEnv('POSTGRES_DB') || 'modbm_volzau';

const pgurl = `postgresql://${user}:${pass}@${host}:${port}/${db}`;

const client = new Client({ connectionString: pgurl });
async function run() {
  await client.connect();
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0053_melted_warbound.sql' WHERE filename='0052_melted_warbound.sql'");
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0054_perpetual_scalphunter.sql' WHERE filename='0053_perpetual_scalphunter.sql'");
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0055_perfect_spectrum.sql' WHERE filename='0054_perfect_spectrum.sql'");
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0056_intra_transit_bins.sql' WHERE filename='0055_intra_transit_bins.sql'");
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0057_purple_iron_patriot.sql' WHERE filename='0055_purple_iron_patriot.sql'");
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0058_glamorous_catseye.sql' WHERE filename='0056_glamorous_catseye.sql'");
  await client.query("UPDATE modbm_core.schema_migrations SET filename='0059_naive_mariko_yashida.sql' WHERE filename='0057_naive_mariko_yashida.sql'");
  console.log('Done');
  await client.end();
}
run().catch(console.error);
