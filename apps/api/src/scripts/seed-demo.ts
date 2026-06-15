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
} from '../drizzle/herobm-core-schema';
import {
  SALES_ORDER_STATE,
  PURCHASE_ORDER_STATE,
  SHIPMENT_STATE,
  SALES_ORDER_PICK_STATE,
  PUTAWAY_STATUS,
} from '@herobm/shared';
import * as schema from '../drizzle/herobm-core-schema';
import * as readline from 'readline';

// Import standard setup functions
import { runStandardSeeds, seedCoaAccounts, seedCoaSettings } from './seed';

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
    await db.insert(locations).values({
      locationId: loc.id,
      code: loc.code,
      name: loc.name,
      isActive: true,
      addressLine1: '123 Warehouse St',
      city: 'Demo City',
      stateOrProvince: 'XX',
      postalCode: '00000',
      country: 'USA',
    });

    await db.insert(zones).values({
      zoneId: loc.zoneId,
      locationId: loc.id,
      code: 'MAIN',
      name: 'Main Storage Zone',
    });

    await db.insert(bins).values({
      binId: loc.binId,
      zoneId: loc.zoneId,
      code: 'A1-01',
      name: 'Default Bin',
    });
  }

  const defaultTax = await db
    .select()
    .from(taxCategories)
    .where(sql`is_default = true`)
    .limit(1);
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
    await db.insert(suppliers).values({
      vendorId: s.id,
      vendorNumber: s.number,
      name: s.name,
      currencyCode: 'USD', // testData
      taxCategoryId: taxCatId,
      tradingTermsId: termId,
    });
  }

  // 4. Customers
  const custs = [
    { id: uuid(), number: 'CUST-001', name: 'Home Hardware Partners' },
    { id: uuid(), number: 'CUST-002', name: 'BuildIt Stores Inc' },
    { id: uuid(), number: 'CUST-003', name: 'Apex Construction' },
    { id: uuid(), number: 'CUST-004', name: 'Texas Builders Group' },
  ];
  for (const c of custs) {
    await db.insert(customers).values({
      customerId: c.id,
      customerNumber: c.number,
      name: c.name,
      currencyCode: 'USD', // testData
      taxCategoryId: taxCatId,
      tradingTermsId: termId,
      creditLimit: '50000.00',
    });
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
    await db.insert(products).values({
      productId: p.id,
      productNumber: p.number,
      name: p.name,
      baseUom: 'EA',
      isActive: true,
    });
  }

  return { locs, sups, custs, prods };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function generateTransactions(db: any, data: MasterData) {
  console.log('Generating historical transactions (12 months)...');
  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );

  // We need a tax category to use
  const taxCats = await db.select().from(taxCategories).limit(1);
  const taxCategoryId = taxCats[0]?.taxCategoryId;

  if (!taxCategoryId) {
    console.warn(
      'No tax category found. Transactions will fail or have no tax.',
    );
  }

  // Generate Purchase Orders
  let poCounter = 1000;
  let entryCounter = 1000;
  for (let i = 0; i < 20; i++) {
    const poDate = randomDate(oneYearAgo, now);
    const supplier = randomItem(data.sups);
    const location = randomItem(data.locs);
    const poId = uuid();

    await db.insert(purchaseOrders).values({
      purchaseOrderId: poId,
      orderNumber: `PO-${poCounter++}`,
      vendorId: supplier.id,
      deliveryLocationId: location.id,
      stateCode: PURCHASE_ORDER_STATE.RECEIVED,
      currencyCode: 'USD', // testData
      createdOn: poDate,
    });

    const numLines = randomInt(1, 5);
    for (let j = 0; j < numLines; j++) {
      const prod = randomItem(data.prods);
      const qty = randomInt(50, 200);
      const poLineId = uuid();

      await db.insert(purchaseOrderLineItems).values({
        purchaseOrderLineId: poLineId,
        purchaseOrderId: poId,
        lineNumber: j + 1,
        productId: prod.id,
        quantity: qty.toString(),
        pricePerUnit: (prod.price * 0.6).toFixed(2), // cost is 60% of retail
        taxCategoryId,
        quantityReceived: qty.toString(),
      });

      // Insert Inventory Entry and Ledger
      const entryId = uuid();
      await db.insert(inventoryEntries).values({
        entryId,
        entryNumber: `RCV-${entryCounter++}`,
        entryDate: poDate,
        sourceType: 'PO_RECEIPT',
        sourceId: poId,
      });

      await db
        .insert(inventoryLedger)
        .values({
          entryId,
          productId: prod.id,
          binId: location.binId,
          locationId: location.id,
          zoneId: location.zoneId,
          quantity: qty.toString(),
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .catch((e: any) => console.error('Ledger error:', e.message));

      // Update binContents
      const existingBin = await db
        .select()
        .from(binContents)
        .where(sql`bin_id = ${location.binId} AND product_id = ${prod.id}`);
      if (existingBin.length > 0) {
        await db.execute(
          sql.raw(
            `UPDATE herobm_core.bin_contents SET actual_quantity = actual_quantity + ${qty} WHERE bin_id = '${location.binId}' AND product_id = '${prod.id}'`,
          ),
        );
      } else {
        await db
          .insert(binContents)
          .values({
            binId: location.binId,
            productId: prod.id,
            actualQuantity: qty.toString(),
          })
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .catch((e: any) => console.error('Bin contents error:', e.message));
      }
    }
  }

  // Generate Sales Orders
  let soCounter = 5000;
  for (let i = 0; i < 50; i++) {
    const soDate = randomDate(oneYearAgo, now);
    const customer = randomItem(data.custs);
    const location = randomItem(data.locs);
    const soId = uuid();
    const isCompleted = Math.random() > 0.3; // 70% chance of being completed

    await db.insert(salesOrders).values({
      salesOrderId: soId,
      orderNumber: `SO-${soCounter++}`,
      customerId: customer.id,
      fulfillmentLocationId: location.id,
      stateCode: isCompleted
        ? SALES_ORDER_STATE.SHIPPED
        : SALES_ORDER_STATE.CONFIRMED,
      currencyCode: 'USD', // testData
      createdOn: soDate,
    });

    const numLines = randomInt(1, 4);
    for (let j = 0; j < numLines; j++) {
      const prod = randomItem(data.prods);
      const qty = randomInt(1, 20);
      const soLineId = uuid();

      await db.insert(salesOrderLineItems).values({
        salesOrderLineId: soLineId,
        salesOrderId: soId,
        lineNumber: j + 1,
        productId: prod.id,
        quantity: qty.toString(),
        pricePerUnit: prod.price.toString(),
        taxCategoryId,
        fulfillmentLocationId: location.id,
        quantityPicked: isCompleted ? qty.toString() : '0',
      });

      if (isCompleted) {
        // Pick
        await db.insert(salesOrderPicks).values({
          salesOrderId: soId,
          salesOrderLineId: soLineId,
          productId: prod.id,
          binId: location.binId,
          quantity: qty.toString(),
          stateCode: SALES_ORDER_PICK_STATE.PICKED,
          createdOn: soDate,
        });

        // Inventory deduction
        const entryId = uuid();
        await db.insert(inventoryEntries).values({
          entryId,
          entryNumber: `SHP-${entryCounter++}`,
          entryDate: soDate,
          sourceType: 'SO_SHIPMENT',
          sourceId: soId,
        });

        // For simplicity, skip proper ledger deduction and just decrease bin_contents directly if it exists
        // (A real app would do this via service layer)
        await db.execute(
          sql.raw(
            `UPDATE herobm_core.bin_contents SET actual_quantity = actual_quantity - ${qty} WHERE bin_id = '${location.binId}' AND product_id = '${prod.id}'`,
          ),
        );
      }
    }

    if (isCompleted) {
      const shipId = uuid();
      await db.insert(salesOrderShipments).values({
        shipmentId: shipId,
        shipmentNumber: `SH-${soCounter}`,
        salesOrderId: soId,
        stateCode: SHIPMENT_STATE.DISPATCHED,
        fulfillmentLocationId: location.id,
        createdOn: soDate,
      });
    }
  }

  console.log('Transactions generated.');
}

async function confirmExecution(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      'WARNING: This will WIPE the database and populate demo data! Are you sure you want to proceed? [y/N] ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      },
    );
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.includes('--force') && !args.includes('-y')) {
    const confirmed = await confirmExecution();
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }

  const pool = new Pool({
    host: process.env.POSTGRES_HOST || '127.0.0.1',
    port: Number(process.env.POSTGRES_PORT) || 5432,
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD,
    database: process.env.POSTGRES_DB || 'herobm',
  });

  const db = drizzle(pool, { schema });

  try {
    await wipeDatabase(db);

    // Run the framework seeds (Users, Apps settings, etc.)
    await runStandardSeeds(db, false);
    await seedCoaAccounts(db, false, 'us_standard');
    await seedCoaSettings(db, false, 'us_standard');

    // Run custom tool distribution seeds
    const data = await seedMasterData(db);
    await generateTransactions(db, data);

    console.log('\nDemo Data Seeding Complete!');
  } catch (e) {
    console.error('Seeding failed:', e);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
