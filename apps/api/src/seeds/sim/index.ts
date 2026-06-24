import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import {
  uomDictionary,
  products,
  locations,
  zones,
  bins,
  customers,
  suppliers,
  purchaseOrders,
  purchaseOrderLineItems,
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  inventoryEntries,
  inventoryLedger,
  binContents,
  taxCategories,
  glSettings,
  tradingTerms,
} from '../../drizzle/herobm-core-schema';
import {
  SALES_ORDER_STATE,
  PURCHASE_ORDER_STATE,
  SHIPMENT_STATE,
  SALES_ORDER_PICK_STATE,
  PUTAWAY_STATUS,
} from '@herobm/shared';
import * as schema from '../../drizzle/herobm-core-schema';
import * as readline from 'readline';

// Import standard setup functions
import { seedCoaAccounts, seedCoaSettings } from '../prod/core';
import { runProdSeeds } from '../prod';
import type { SeedDB } from '../run';

function uuid() {
  return crypto.randomUUID();
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomDate(start: Date, end: Date) {
  return new Date(
    start.getTime() + Math.random() * (end.getTime() - start.getTime()),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
async function wipeDatabase(db: any) {
  console.log('Wiping existing database tables (CASCADE)...');
  await db.execute(
    sql.raw(`
    TRUNCATE TABLE 
      herobm_core.inventory_ledger, herobm_core.inventory_entries, herobm_core.bin_contents,
      herobm_core.sales_order_lines, herobm_core.sales_orders, herobm_core.sales_order_picks, herobm_core.sales_order_shipment_lines, herobm_core.sales_order_shipments,
      herobm_core.purchase_order_lines, herobm_core.purchase_orders, herobm_core.procurement_events, herobm_core.sales_events, herobm_core.warehouse_events, herobm_core.master_data_events, herobm_core.financial_events, herobm_core.inventory_events, herobm_core.system_events,
      herobm_core.products, herobm_core.customers, herobm_core.suppliers,
      herobm_core.bins, herobm_core.zones, herobm_core.locations,
      herobm_core.tax_categories, herobm_core.uom_dictionary,
      herobm_core.organization, herobm_core.gl_settings, herobm_core.app_settings,
      herobm_core.users, herobm_core.gl_accounts
    CASCADE;
  `),
  );
  console.log('Database wiped.');
}

interface MasterData {
  locs: {
    id: string;
    code: string;
    name: string;
    zoneId: string;
    binId: string;
  }[];
  sups: { id: string; number: string; name: string }[];
  custs: { id: string; number: string; name: string }[];
  prods: { id: string; number: string; name: string; price: number }[];
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
async function seedMasterData(db: any): Promise<MasterData> {
  console.log(
    'Seeding Master Data (Locations, Suppliers, Customers, Products)...',
  );

  // 1. Locations (Warehouses)
  const locs = [
    {
      id: uuid(),
      code: 'WC-DC',
      name: 'West Coast Hub (Los Angeles, CA)',
      zoneId: uuid(),
      binId: uuid(),
    },
    {
      id: uuid(),
      code: 'C-DC',
      name: 'Central Retail DC (Dallas, TX)',
      zoneId: uuid(),
      binId: uuid(),
    },
    {
      id: uuid(),
      code: 'EC-DC',
      name: 'East Coast Hub (Allentown, PA)',
      zoneId: uuid(),
      binId: uuid(),
    },
  ];

  for (const loc of locs) {
    await db
      .insert(locations)
      .values({
        locationId: loc.id,
        code: loc.code,
        name: loc.name,
        isActive: true,
        addressLine1: '123 Warehouse St',
        city: 'Demo City',
        state: 'XX',
        postCode: '00000',
        country: 'USA',
      })
      .onConflictDoNothing();

    await db
      .insert(zones)
      .values({
        zoneId: loc.zoneId,
        locationId: loc.id,
        code: 'MAIN',
        name: 'Main Storage Zone',
      })
      .onConflictDoNothing();

    await db
      .insert(bins)
      .values({
        binId: loc.binId,
        zoneId: loc.zoneId,
        binNumber: 'A1-01',
        binType: 'storage',
      })
      .onConflictDoNothing();
  }

  const defaultTax = await db.select().from(taxCategories).limit(1);
  const taxCatId = defaultTax[0]?.taxCategoryId;

  const defaultTerm = await db
    .select()
    .from(tradingTerms)
    .where(sql`code = 'NET30'`)
    .limit(1);
  const termId = defaultTerm[0]?.tradingTermsId;

  // 3. Suppliers
  const sups = [
    { id: uuid(), number: 'SUP-001', name: 'Milwaukee Tool Corp' },
    { id: uuid(), number: 'SUP-002', name: 'DeWalt Industrial' },
    { id: uuid(), number: 'SUP-003', name: 'Makita USA' },
    { id: uuid(), number: 'SUP-004', name: 'Bosch Power Tools' },
  ];
  for (const s of sups) {
    await db
      .insert(suppliers)
      .values({
        vendorId: s.id,
        vendorNumber: s.number,
        name: s.name,
        currencyCode: 'USD', // testData
        taxCategoryId: taxCatId,
        tradingTermsId: termId,
        address1Country: 'USA',
      })
      .onConflictDoNothing();
  }

  // 4. Customers
  const custs = [
    { id: uuid(), number: 'CUST-001', name: 'Home Hardware Partners' },
    { id: uuid(), number: 'CUST-002', name: 'BuildIt Stores Inc' },
    { id: uuid(), number: 'CUST-003', name: 'Apex Construction' },
    { id: uuid(), number: 'CUST-004', name: 'Texas Builders Group' },
  ];
  for (const c of custs) {
    await db
      .insert(customers)
      .values({
        customerId: c.id,
        customerNumber: c.number,
        name: c.name,
        currencyCode: 'USD', // testData
        taxCategoryId: taxCatId,
        tradingTermsId: termId,
        creditLimit: '50000.00',
        billingAddressCountry: 'USA',
      })
      .onConflictDoNothing();
  }

  // 5. Products
  await db
    .insert(uomDictionary)
    .values({ uomCode: 'BOX', description: 'Box' })
    .onConflictDoNothing();

  const prods = [
    { id: uuid(), number: 'TL-1001', name: '18V Hammer Drill', price: 199.99 },
    { id: uuid(), number: 'TL-1002', name: '20V Circular Saw', price: 149.5 },
    {
      id: uuid(),
      number: 'TL-1003',
      name: 'Angle Grinder 4-1/2"',
      price: 89.0,
    },
    { id: uuid(), number: 'HT-2001', name: '16oz Claw Hammer', price: 24.99 },
    { id: uuid(), number: 'HT-2002', name: '25ft Tape Measure', price: 15.5 },
    { id: uuid(), number: 'AC-3001', name: '5.0Ah Battery Pack', price: 129.0 },
    {
      id: uuid(),
      number: 'AC-3002',
      name: '10-piece Drill Bit Set',
      price: 35.0,
    },
  ];

  for (const p of prods) {
    await db
      .insert(products)
      .values({
        productId: p.id,
        productNumber: p.number,
        name: p.name,
        baseUom: 'EA',
        isActive: true,
        productType: 'inventory',
      })
      .onConflictDoNothing();
  }

  return { locs, sups, custs, prods };
}

export async function runSimSeeds(db: SeedDB, dryRun = false) {
  try {
    console.log('Wiping existing database tables (CASCADE)...');
    await db.execute(
      sql.raw(`
      TRUNCATE TABLE 
        herobm_core.inventory_ledger, herobm_core.inventory_entries, herobm_core.bin_contents,
        herobm_core.sales_order_lines, herobm_core.sales_orders, herobm_core.sales_order_picks, herobm_core.sales_order_shipment_lines, herobm_core.sales_order_shipments,
        herobm_core.purchase_order_lines, herobm_core.purchase_orders, herobm_core.procurement_events, herobm_core.sales_events, herobm_core.warehouse_events, herobm_core.master_data_events, herobm_core.financial_events, herobm_core.inventory_events, herobm_core.system_events,
        herobm_core.products, herobm_core.customers, herobm_core.suppliers,
        herobm_core.bins, herobm_core.zones, herobm_core.locations,
        herobm_core.tax_categories, herobm_core.uom_dictionary,
        herobm_core.organization, herobm_core.gl_settings, herobm_core.app_settings,
        herobm_core.users, herobm_core.gl_accounts
      CASCADE;
    `),
    );
    console.log('Database wiped.');

    // Run standard seeds first
    const { runProdSeeds } = await import('../prod/index.js');
    await runProdSeeds(db, dryRun);

    // Run custom tool distribution seeds for sim
    const data = await seedMasterData(db);

    console.log('\nSim Data Seeding Complete!');
  } catch (e) {
    console.error('Seeding failed:', e);
  }
}
