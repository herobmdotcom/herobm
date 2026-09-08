import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { customers, suppliers, organizations } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({
  path: path.join(__dirname, '../../../../' + (process.env.ENV_FILE || '.env')),
});

function mapCountryCode(val: string | null): string | undefined {
  if (!val) return undefined;
  const up = val.toUpperCase().trim();
  if (['AUSTRALIA', 'AUST', 'AU'].includes(up)) return 'AU';
  if (['NEW ZEALAND', 'NZ'].includes(up)) return 'NZ';
  if (['UNITED STATES', 'USA', 'US'].includes(up)) return 'US';
  if (['UNITED KINGDOM', 'UK', 'GB'].includes(up)) return 'GB';
  if (['GERMANY', 'DE'].includes(up)) return 'DE';
  if (['FRANCE', 'FR'].includes(up)) return 'FR';
  if (['ITALY', 'IT'].includes(up)) return 'IT';
  if (['SPAIN', 'ES'].includes(up)) return 'ES';
  if (['NETHERLANDS', 'NL'].includes(up)) return 'NL';
  if (['CHINA', 'CN'].includes(up)) return 'CN';
  if (['JAPAN', 'JP'].includes(up)) return 'JP';
  if (['INDIA', 'IN'].includes(up)) return 'IN';
  if (['SINGAPORE', 'SG'].includes(up)) return 'SG';
  if (['SOUTH AFRICA', 'ZA'].includes(up)) return 'ZA';
  if (['CANADA', 'CA'].includes(up)) return 'CA';
  if (['IRELAND', 'IE'].includes(up)) return 'IE';
  if (['SWITZERLAND', 'CH'].includes(up)) return 'CH';
  return val;
}

function mapCurrencyCode(val: string | null): string | undefined {
  if (!val) return undefined;
  const up = val.toUpperCase().trim();
  if (up === 'AU') return 'AUD'; // HOME_CURRENCY
  if (up === 'US') return 'USD'; // HOME_CURRENCY
  if (up === 'GB') return 'GBP'; // HOME_CURRENCY
  if (up === 'EU') return 'EUR'; // HOME_CURRENCY
  if (up === 'NZ') return 'NZD'; // HOME_CURRENCY
  return val;
}

async function run() {
  const connectionString = `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`;
  const client = postgres(connectionString);
  const db = drizzle(client);

  console.log('--- Fixing Customer Countries & Currencies ---');
  const allCustomers = await db
    .select({
      customerId: customers.customerId,
      organizationId: customers.organizationId,
      currencyCode: customers.currencyCode,
      headquartersCountry: organizations.headquartersCountry,
    })
    .from(customers)
    .leftJoin(
      organizations,
      eq(customers.organizationId, organizations.organizationId),
    );

  let updatedCustomers = 0;
  for (const c of allCustomers) {
    const newCountry = mapCountryCode(c.headquartersCountry);
    const newCurrency = mapCurrencyCode(c.currencyCode);

    let hasUpdate = false;
    if (newCurrency && newCurrency !== c.currencyCode) {
      await db
        .update(customers)
        .set({ currencyCode: newCurrency })
        .where(eq(customers.customerId, c.customerId));
      hasUpdate = true;
    }

    if (
      newCountry &&
      newCountry !== c.headquartersCountry &&
      c.organizationId
    ) {
      await db
        .update(organizations)
        .set({ headquartersCountry: newCountry })
        .where(eq(organizations.organizationId, c.organizationId));
      hasUpdate = true;
    }

    if (hasUpdate) updatedCustomers++;
  }
  console.log(`Updated ${updatedCustomers} customers.`);

  console.log('--- Fixing Supplier Countries & Currencies ---');
  const allSuppliers = await db
    .select({
      vendorId: suppliers.vendorId,
      organizationId: suppliers.organizationId,
      currencyCode: suppliers.currencyCode,
      headquartersCountry: organizations.headquartersCountry,
    })
    .from(suppliers)
    .leftJoin(
      organizations,
      eq(suppliers.organizationId, organizations.organizationId),
    );

  let updatedSuppliers = 0;
  for (const s of allSuppliers) {
    const newCountry = mapCountryCode(s.headquartersCountry);
    const newCurrency = mapCurrencyCode(s.currencyCode);

    let hasUpdate = false;
    if (newCurrency && newCurrency !== s.currencyCode) {
      await db
        .update(suppliers)
        .set({ currencyCode: newCurrency })
        .where(eq(suppliers.vendorId, s.vendorId));
      hasUpdate = true;
    }

    if (
      newCountry &&
      newCountry !== s.headquartersCountry &&
      s.organizationId
    ) {
      await db
        .update(organizations)
        .set({ headquartersCountry: newCountry })
        .where(eq(organizations.organizationId, s.organizationId));
      hasUpdate = true;
    }

    if (hasUpdate) updatedSuppliers++;
  }
  console.log(`Updated ${updatedSuppliers} suppliers.`);

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
