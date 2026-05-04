/**
 * Manual migration script: creates payment_entries, payment_allocations,
 * cost_centers, activities tables and adds outstanding_amount columns
 * to sales_invoices and purchase_invoices.
 *
 * Usage:
 *   npx ts-node src/scripts/migrate-payments.ts                  # uses .env
 *   npx ts-node src/scripts/migrate-payments.ts --profile volzau # uses .env.volzau
 */
import postgres from 'postgres';
import { resolve } from 'path';

// Parse --profile flag
const profileIdx = process.argv.indexOf('--profile');
const profile = profileIdx !== -1 ? process.argv[profileIdx + 1] : undefined;
const envFile = profile ? `.env.${profile}` : '.env';
const envPath = resolve(__dirname, '../../../../', envFile);

console.log(`Loading env from: ${envPath}`);
process.loadEnvFile(envPath);

const sql = postgres({
  host: process.env.POSTGRES_HOST ?? 'localhost',
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  database: process.env.POSTGRES_DB ?? 'custom_app',
});

async function main() {
  console.log(
    `Connecting to ${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`,
  );

  // 1. Verify connectivity
  const [{ now }] = await sql`SELECT now()`;
  console.log('Connected at', now);

  // 2. payment_entries
  await sql`
    CREATE TABLE IF NOT EXISTS modbm_core.payment_entries (
      payment_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_number    TEXT UNIQUE NOT NULL,
      payment_type      TEXT NOT NULL,
      party_type        TEXT NOT NULL,
      party_id          UUID NOT NULL,
      payment_date      TIMESTAMPTZ NOT NULL,
      mode_of_payment   TEXT NOT NULL,
      total_amount      NUMERIC NOT NULL,
      unallocated_amount NUMERIC NOT NULL,
      gl_account_bank   UUID NOT NULL REFERENCES modbm_core.gl_accounts(gl_account_id),
      reference_number  TEXT,
      state_code        TEXT NOT NULL DEFAULT 'draft',
      currency_code     TEXT NOT NULL,
      created_by        TEXT,
      created_on        TIMESTAMPTZ DEFAULT now(),
      modified_on       TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log('✓ payment_entries');

  // 3. payment_allocations
  await sql`
    CREATE TABLE IF NOT EXISTS modbm_core.payment_allocations (
      allocation_id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      payment_id       UUID NOT NULL REFERENCES modbm_core.payment_entries(payment_id),
      reference_type   TEXT NOT NULL,
      reference_id     UUID NOT NULL,
      allocated_amount NUMERIC NOT NULL,
      created_on       TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log('✓ payment_allocations');

  // 4. cost_centers
  await sql`
    CREATE TABLE IF NOT EXISTS modbm_core.cost_centers (
      cost_center_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code           TEXT UNIQUE NOT NULL,
      name           TEXT NOT NULL,
      is_system      BOOLEAN NOT NULL DEFAULT false,
      is_active      BOOLEAN NOT NULL DEFAULT true,
      created_on     TIMESTAMPTZ DEFAULT now(),
      modified_on    TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log('✓ cost_centers');

  // 5. activities
  await sql`
    CREATE TABLE IF NOT EXISTS modbm_core.activities (
      activity_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code        TEXT UNIQUE NOT NULL,
      name        TEXT NOT NULL,
      is_system   BOOLEAN NOT NULL DEFAULT false,
      is_active   BOOLEAN NOT NULL DEFAULT true,
      created_on  TIMESTAMPTZ DEFAULT now(),
      modified_on TIMESTAMPTZ DEFAULT now()
    )
  `;
  console.log('✓ activities');

  // 6. outstanding_amount on invoices
  await sql`
    ALTER TABLE modbm_core.sales_invoices
      ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC NOT NULL DEFAULT 0
  `;
  console.log('✓ sales_invoices.outstanding_amount');

  await sql`
    ALTER TABLE modbm_core.purchase_invoices
      ADD COLUMN IF NOT EXISTS outstanding_amount NUMERIC NOT NULL DEFAULT 0
  `;
  console.log('✓ purchase_invoices.outstanding_amount');

  // 7. cost_center_id / activity_id on gl_journal_lines
  await sql`
    ALTER TABLE modbm_core.gl_journal_lines
      ADD COLUMN IF NOT EXISTS cost_center_id UUID
        REFERENCES modbm_core.cost_centers(cost_center_id)
  `;
  await sql`
    ALTER TABLE modbm_core.gl_journal_lines
      ADD COLUMN IF NOT EXISTS activity_id UUID
        REFERENCES modbm_core.activities(activity_id)
  `;
  console.log('✓ gl_journal_lines dimension columns');

  // 8. Verify
  const tables = await sql`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'modbm_core'
       AND table_name IN ('payment_entries', 'payment_allocations', 'cost_centers', 'activities')
     ORDER BY table_name
  `;
  console.log(
    '\nVerification — tables found:',
    tables.map((r: any) => r.table_name),
  );

  await sql.end();
  console.log('\n✅ Migration complete.');
}

void main().catch(async (err) => {
  console.error('Migration failed:', err);
  await sql.end();
  process.exit(1);
});
