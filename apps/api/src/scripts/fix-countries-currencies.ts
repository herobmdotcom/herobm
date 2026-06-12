import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { customers, suppliers } from '../drizzle/modbm-core-schema';
import { eq } from 'drizzle-orm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.volzau from root
dotenv.config({ path: path.join(__dirname, '../../../../.env.volzau') });

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
  const allCustomers = await db.select().from(customers);
  let updatedCustomers = 0;
  for (const c of allCustomers) {
    const newCountry = mapCountryCode(c.billingAddressCountry);
    const newCurrency = mapCurrencyCode(c.currencyCode);
    if (
      newCountry !== c.billingAddressCountry ||
      newCurrency !== c.currencyCode
    ) {
      await db
        .update(customers)
        .set({ billingAddressCountry: newCountry, currencyCode: newCurrency })
        .where(eq(customers.customerId, c.customerId));
      updatedCustomers++;
    }
  }
  console.log(`Updated ${updatedCustomers} customers.`);

  console.log('--- Fixing Supplier Countries & Currencies ---');
  const allSuppliers = await db.select().from(suppliers);
  let updatedSuppliers = 0;
  for (const s of allSuppliers) {
    const newCountry = mapCountryCode(s.address1Country);
    const newCurrency = mapCurrencyCode(s.currencyCode);
    if (newCountry !== s.address1Country || newCurrency !== s.currencyCode) {
      await db
        .update(suppliers)
        .set({ address1Country: newCountry, currencyCode: newCurrency })
        .where(eq(suppliers.vendorId, s.vendorId));
      updatedSuppliers++;
    }
  }
  console.log(`Updated ${updatedSuppliers} suppliers.`);

  await client.end();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
