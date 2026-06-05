import postgres from 'postgres';
import { resolve } from 'path';

// Assumes we are running from project root or inside apps/api
const envPath = resolve(__dirname, '../../../../.env');
try {
  process.loadEnvFile(envPath);
  console.log(`Loaded environment from ${envPath}`);
} catch (err) {
  console.warn(`Could not load environment from ${envPath}:`, err);
}

const sql = postgres({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB ?? 'herobm',
});

const renameMap: Record<string, string> = {
  '0053_melted_warbound.sql': '0053_create_transfer_orders.sql',
  '0054_perpetual_scalphunter.sql': '0054_add_in_transit_bin_type.sql',
  '0055_perfect_spectrum.sql': '0055_create_transfer_order_shipments.sql',
  '0057_purple_iron_patriot.sql': '0057_create_payment_events.sql',
  '0058_glamorous_catseye.sql': '0058_add_bank_account_metadata.sql',
  '0059_naive_mariko_yashida.sql': '0059_create_sales_credit_notes.sql',
  '0060_bouncy_beyonder.sql': '0060_add_putaway_status_to_return_lines.sql',
  '0061_gifted_human_fly.sql': '0061_add_quantity_received_to_return_lines.sql',
  '0062_chubby_pride.sql': '0062_add_partially_received_to_return_state.sql',
  '0063_omniscient_purple_man.sql': '0063_add_account_metadata_schema.sql',
  '0063_futuristic_veda.sql': '0065_create_product_components.sql',
};

async function main() {
  console.log('Synchronizing Drizzle migration names in the database...');

  // 1. Fetch current migrations from the DB
  const existingMigrations = await sql<{ filename: string }[]>`
    SELECT filename FROM modbm_core.schema_migrations;
  `;

  const migrationSet = new Set(existingMigrations.map((m) => m.filename));
  console.log(`Found ${migrationSet.size} applied migrations in database.`);

  let updatedCount = 0;

  for (const [oldName, newName] of Object.entries(renameMap)) {
    if (migrationSet.has(oldName)) {
      console.log(`Syncing rename: ${oldName} -> ${newName}`);
      await sql`
        UPDATE modbm_core.schema_migrations
        SET filename = ${newName}
        WHERE filename = ${oldName};
      `;
      updatedCount++;
    } else if (migrationSet.has(newName)) {
      console.log(`Migration already synced: ${newName}`);
    } else {
      console.log(
        `Migration not applied in database yet: ${oldName} / ${newName}`,
      );
    }
  }

  console.log(`Finished synchronizing. Updated ${updatedCount} records.`);
  process.exit(0);
}

void main().catch((err) => {
  console.error('Error during synchronization:', err);
  process.exit(1);
});
