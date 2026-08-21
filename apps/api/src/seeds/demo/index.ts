import * as crypto from 'crypto';
import * as readline from 'readline';
import { sql, eq } from 'drizzle-orm';
import {
  uomDictionary,
  productGroups,
  products,
  productSuppliers,
  productDefaultBins,
  locations,
  zones,
  bins,
  actors,
  contacts,
  actorContactLinks,
  customers,
  customerDeliveryAddresses,
  suppliers,
  purchaseOrders,
  purchaseOrderLineItems,
  goodsReceived,
  goodsReceivedLines,
  purchaseInvoices,
  purchaseInvoiceLines,
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesInvoices,
  salesInvoiceLines,
  inventoryEntries,
  inventoryLedger,
  binContents,
  taxCategories,
  glSettings,
  tradingTerms,
  masterDataEvents,
  procurementEvents,
  salesEvents,
  inventoryEvents,
} from '@herobm/db-schema';
import {
  BIN_TYPE,
  SALES_ORDER_STATE,
  SalesOrderState,
  PURCHASE_ORDER_STATE,
  PurchaseOrderState,
  PURCHASE_INVOICE_STATE,
  GOODS_RECEIVED_STATE,
  MATCH_STATUS,
  SHIPMENT_STATE,
  SALES_ORDER_PICK_STATE,
  SALES_INVOICE_STATE,
  PUTAWAY_STATUS,
  SUPPLIER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
  CONTACT_STATE,
} from '@herobm/shared';

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

export async function wipeDatabase(db: SeedDB) {
  console.log('Wiping existing database tables (CASCADE)...');
  await db.execute(sql`
    TRUNCATE TABLE 
      herobm_core.inventory_ledger, herobm_core.inventory_entries, herobm_core.bin_contents, herobm_core.product_default_bins,
      herobm_core.sales_credit_note_lines, herobm_core.sales_credit_notes, herobm_core.sales_order_return_lines, herobm_core.sales_order_returns,
      herobm_core.sales_invoice_lines, herobm_core.sales_invoices, herobm_core.sales_order_shipment_lines, herobm_core.sales_order_shipments,
      herobm_core.sales_order_picks, herobm_core.sales_order_lines, herobm_core.sales_orders, herobm_core.backorders,
      herobm_core.purchase_invoice_receipts, herobm_core.purchase_invoice_lines, herobm_core.purchase_invoices,
      herobm_core.purchase_debit_note_shipments, herobm_core.purchase_debit_note_lines, herobm_core.purchase_debit_notes,
      herobm_core.purchase_order_return_shipment_lines, herobm_core.purchase_order_return_shipments, herobm_core.purchase_order_return_lines, herobm_core.purchase_order_returns,
      herobm_core.goods_received_lines, herobm_core.goods_received, herobm_core.purchase_order_lines, herobm_core.purchase_orders,
      herobm_core.supplier_expiries, herobm_core.product_suppliers, herobm_core.product_components, herobm_core.product_uoms, herobm_core.discount_matrix,
      herobm_core.products, herobm_core.product_groups, herobm_core.uom_dictionary,
      herobm_core.customer_delivery_addresses, herobm_core.customers, herobm_core.customer_groups,
      herobm_core.suppliers, herobm_core.supplier_groups,
      herobm_core.actor_contact_links, herobm_core.actor_actor_links, herobm_core.actor_notes, herobm_core.contacts,
      herobm_core.project_actors, herobm_core.project_contacts, herobm_core.project_notes, herobm_core.projects,
      herobm_core.actors,
      herobm_core.bins, herobm_core.zones, herobm_core.locations,
      herobm_core.tax_position_mappings, herobm_core.tax_positions, herobm_core.tax_categories, herobm_core.trading_terms,
      herobm_core.gl_journal_lines, herobm_core.gl_journal_entries, herobm_core.cost_centers, herobm_core.activities, herobm_core.gl_settings, herobm_core.gl_accounts,
      herobm_core.procurement_events, herobm_core.sales_events, herobm_core.warehouse_events, herobm_core.master_data_events,
      herobm_core.financial_events, herobm_core.inventory_events, herobm_core.system_events, herobm_core.user_events,
      herobm_core.business_report_events, herobm_core.email_events, herobm_core.integration_events, herobm_core.group_events,
      herobm_core.organization, herobm_core.app_settings, herobm_core.users, herobm_core.casbin_rule
    CASCADE;
  `);
  console.log('Database wiped.');
}

export interface MasterLocation {
  id: string;
  code: string;
  name: string;
  storageBinId: string;
  pickBinId: string;
  bulkBinId: string;
  stagingBinId: string;
  mainZoneId: string;
}

export interface MasterProduct {
  id: string;
  number: string;
  name: string;
  listPrice: number;
  standardCost: number;
  tradePrice: number;
  productGroupId: string;
}

export interface MasterActorSupplier {
  actorId: string;
  vendorId: string;
  number: string;
  name: string;
}

export interface MasterActorCustomer {
  actorId: string;
  customerId: string;
  number: string;
  name: string;
}

export interface MasterData {
  locs: MasterLocation[];
  sups: MasterActorSupplier[];
  custs: MasterActorCustomer[];
  prods: MasterProduct[];
  taxCategoryId: string;
  baseCurrency: string;
}

export async function seedMasterData(db: SeedDB): Promise<MasterData> {
  console.log(
    'Seeding Master Data (Locations, Zones, Bins, Product Groups, Products, CRM Actors, Suppliers, Customers)...',
  );

  // 1. Resolve Base Currency and Global Reference Data
  const glSettingRows = await db.select().from(glSettings).limit(1);
  const baseCurrency = glSettingRows[0]?.baseCurrency || 'USD';

  const taxCatRows = await db.select().from(taxCategories).limit(1);
  const taxCatId = taxCatRows[0]?.taxCategoryId;
  if (!taxCatId) {
    throw new Error(
      'Tax categories must be seeded before running demo master data.',
    );
  }

  const defaultTermRows = await db
    .select()
    .from(tradingTerms)
    .where(eq(tradingTerms.code, 'NET30'))
    .limit(1);
  const termId = defaultTermRows[0]?.tradingTermsId || null;

  // 2. Locations (Warehouses), Zones, and Bins
  const locConfigs = [
    {
      id: uuid(),
      code: 'WC-DC',
      name: 'West Coast Logistics Hub',
      addressLine1: '1000 Santa Fe Ave',
      city: 'Los Angeles',
      stateOrProvince: 'CA',
      postalCode: '90021',
      country: 'USA',
    },
    {
      id: uuid(),
      code: 'C-DC',
      name: 'Central Retail DC',
      addressLine1: '2500 Distribution Way',
      city: 'Dallas',
      stateOrProvince: 'TX',
      postalCode: '75261',
      country: 'USA',
    },
    {
      id: uuid(),
      code: 'EC-DC',
      name: 'East Coast Distribution Center',
      addressLine1: '400 Lehigh Valley Logistics Rd',
      city: 'Allentown',
      stateOrProvince: 'PA',
      postalCode: '18109',
      country: 'USA',
    },
  ];

  const locs: MasterLocation[] = [];

  for (const loc of locConfigs) {
    await db
      .insert(locations)
      .values({
        locationId: loc.id,
        code: loc.code,
        name: loc.name,
        addressLine1: loc.addressLine1,
        city: loc.city,
        stateOrProvince: loc.stateOrProvince,
        postalCode: loc.postalCode,
        country: loc.country,
        source: 'app',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    const mainZoneId = uuid();
    const pickZoneId = uuid();
    const bulkZoneId = uuid();
    const stagingZoneId = uuid();

    await db
      .insert(zones)
      .values([
        {
          zoneId: mainZoneId,
          locationId: loc.id,
          code: 'MAIN',
          name: 'Main Storage Zone',
          source: 'app',
          createdBy: 'system',
        },
        {
          zoneId: pickZoneId,
          locationId: loc.id,
          code: 'PICK',
          name: 'Active Pick Zone',
          source: 'app',
          createdBy: 'system',
        },
        {
          zoneId: bulkZoneId,
          locationId: loc.id,
          code: 'BULK',
          name: 'Bulk Pallet Racking',
          source: 'app',
          createdBy: 'system',
        },
        {
          zoneId: stagingZoneId,
          locationId: loc.id,
          code: 'STAGE',
          name: 'Inbound/Outbound Staging Area',
          source: 'app',
          createdBy: 'system',
        },
      ])
      .onConflictDoNothing();

    const storageBinId = uuid();
    const pickBinId = uuid();
    const bulkBinId = uuid();
    const stagingBinId = uuid();

    await db
      .insert(bins)
      .values([
        {
          binId: storageBinId,
          zoneId: mainZoneId,
          binNumber: 'A1-01',
          binType: BIN_TYPE.STORAGE,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: pickBinId,
          zoneId: pickZoneId,
          binNumber: 'P1-01',
          binType: BIN_TYPE.PICK,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: bulkBinId,
          zoneId: bulkZoneId,
          binNumber: 'B1-01',
          binType: BIN_TYPE.BULK,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: stagingBinId,
          zoneId: stagingZoneId,
          binNumber: 'STAGE-01',
          binType: BIN_TYPE.STAGING,
          source: 'app',
          createdBy: 'system',
        },
      ])
      .onConflictDoNothing();

    locs.push({
      id: loc.id,
      code: loc.code,
      name: loc.name,
      storageBinId,
      pickBinId,
      bulkBinId,
      stagingBinId,
      mainZoneId,
    });
  }

  // 3. Product Groups and UOMs
  const powerToolsGroupId = uuid();
  const handToolsGroupId = uuid();
  const accessoriesGroupId = uuid();

  await db
    .insert(productGroups)
    .values([
      {
        productGroupId: powerToolsGroupId,
        groupCode: 'POWER-TOOLS',
        name: 'Power Tools & Machinery',
        salesTaxCategoryId: taxCatId,
        purchaseTaxCategoryId: taxCatId,
      },
      {
        productGroupId: handToolsGroupId,
        groupCode: 'HAND-TOOLS',
        name: 'Hand Tools & Manual Equipment',
        salesTaxCategoryId: taxCatId,
        purchaseTaxCategoryId: taxCatId,
      },
      {
        productGroupId: accessoriesGroupId,
        groupCode: 'ACCESSORIES',
        name: 'Accessories, Bits & Fasteners',
        salesTaxCategoryId: taxCatId,
        purchaseTaxCategoryId: taxCatId,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(uomDictionary)
    .values([
      { uomCode: 'BOX', description: 'Box of 10' },
      { uomCode: 'SET', description: 'Complete Tool Set' },
    ])
    .onConflictDoNothing();

  // 4. Products
  const prodConfigs = [
    {
      id: uuid(),
      number: 'TL-1001',
      name: '18V Cordless Hammer Drill',
      listPrice: 199.99,
      standardCost: 110.0,
      tradePrice: 169.99,
      productGroupId: powerToolsGroupId,
    },
    {
      id: uuid(),
      number: 'TL-1002',
      name: '20V Max Circular Saw 7-1/4"',
      listPrice: 149.5,
      standardCost: 85.0,
      tradePrice: 129.5,
      productGroupId: powerToolsGroupId,
    },
    {
      id: uuid(),
      number: 'TL-1003',
      name: '4-1/2" Angle Grinder 11 Amp',
      listPrice: 89.0,
      standardCost: 48.0,
      tradePrice: 75.0,
      productGroupId: powerToolsGroupId,
    },
    {
      id: uuid(),
      number: 'HT-2001',
      name: '16oz Anti-Vibration Claw Hammer',
      listPrice: 24.99,
      standardCost: 12.0,
      tradePrice: 19.99,
      productGroupId: handToolsGroupId,
    },
    {
      id: uuid(),
      number: 'HT-2002',
      name: '25ft Magnetic Heavy-Duty Tape Measure',
      listPrice: 15.5,
      standardCost: 7.5,
      tradePrice: 12.5,
      productGroupId: handToolsGroupId,
    },
    {
      id: uuid(),
      number: 'HT-2003',
      name: '10" High-Leverage Adjustable Wrench Pro',
      listPrice: 29.99,
      standardCost: 14.0,
      tradePrice: 24.0,
      productGroupId: handToolsGroupId,
    },
    {
      id: uuid(),
      number: 'AC-3001',
      name: '18V 5.0Ah Li-Ion High Output Battery Pack',
      listPrice: 129.0,
      standardCost: 65.0,
      tradePrice: 105.0,
      productGroupId: accessoriesGroupId,
    },
    {
      id: uuid(),
      number: 'AC-3002',
      name: 'Titanium Coated Drill Bit Set 21-Piece',
      listPrice: 35.0,
      standardCost: 16.0,
      tradePrice: 28.0,
      productGroupId: accessoriesGroupId,
    },
    {
      id: uuid(),
      number: 'AC-3003',
      name: 'Heavy Duty Modular Tool Bag 18"',
      listPrice: 45.0,
      standardCost: 20.0,
      tradePrice: 36.0,
      productGroupId: accessoriesGroupId,
    },
  ];

  const prods: MasterProduct[] = [];

  for (const p of prodConfigs) {
    await db
      .insert(products)
      .values({
        productId: p.id,
        productNumber: p.number,
        name: p.name,
        baseUom: 'EA',
        productType: 'inventory',
        structureType: 'standard',
        productGroupId: p.productGroupId,
        listPrice: p.listPrice.toFixed(2),
        standardCost: p.standardCost.toFixed(2),
        tradePrice: p.tradePrice.toFixed(2),
        salesTaxCategoryId: taxCatId,
        purchaseTaxCategoryId: taxCatId,
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    // Link default bin for primary location
    await db
      .insert(productDefaultBins)
      .values({
        productDefaultBinId: uuid(),
        productId: p.id,
        locationId: locs[0].id,
        binId: locs[0].pickBinId,
        isPrimaryPerLocation: true,
      })
      .onConflictDoNothing();

    prods.push(p);
  }

  // 5. CRM Actors & Suppliers
  const supConfigs = [
    {
      number: 'SUP-001',
      name: 'Milwaukee Tool Corporation',
      address: '13135 W Lisbon Rd',
      city: 'Brookfield',
      state: 'WI',
      zip: '53005',
      contactFirst: 'David',
      contactLast: 'Miller',
      email: 'orders@milwaukeetool-demo.com',
    },
    {
      number: 'SUP-002',
      name: 'DeWalt Industrial Tool Co',
      address: '701 E Joppa Rd',
      city: 'Towson',
      state: 'MD',
      zip: '21286',
      contactFirst: 'Sarah',
      contactLast: 'Jenkins',
      email: 'sales@dewalt-demo.com',
    },
    {
      number: 'SUP-003',
      name: 'Makita USA Industrial',
      address: '14930 Northam St',
      city: 'La Mirada',
      state: 'CA',
      zip: '90638',
      contactFirst: 'Kenji',
      contactLast: 'Takahashi',
      email: 'commercial@makita-demo.com',
    },
    {
      number: 'SUP-004',
      name: 'Bosch Power Tools North America',
      address: '1800 W Central Rd',
      city: 'Mount Prospect',
      state: 'IL',
      zip: '60056',
      contactFirst: 'Marcus',
      contactLast: 'Weber',
      email: 'supply@boschtools-demo.com',
    },
  ];

  const sups: MasterActorSupplier[] = [];

  for (const s of supConfigs) {
    const actorId = uuid();
    const vendorId = uuid();

    await db
      .insert(actors)
      .values({
        actorId,
        name: s.name,
        stateCode: ACTOR_STATE.ACTIVE,
        isTaxRegistered: true,
        headquartersAddressLine1: s.address,
        headquartersCity: s.city,
        headquartersStateOrProvince: s.state,
        headquartersPostalCode: s.zip,
        headquartersCountry: 'USA',
        email: s.email,
        telephone: '+1-800-555-0199',
        industry: 'Tool & Equipment Manufacturing',
      })
      .onConflictDoNothing();

    await db
      .insert(suppliers)
      .values({
        vendorId,
        actorId,
        vendorNumber: s.number,
        currencyCode: baseCurrency,
        tradingTermsId: termId,
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    const contactId = uuid();
    await db
      .insert(contacts)
      .values({
        contactId,
        stateCode: CONTACT_STATE.ACTIVE,
        firstName: s.contactFirst,
        lastName: s.contactLast,
        fullName: `${s.contactFirst} ${s.contactLast}`,
        jobTitle: 'Account Representative',
        email: s.email,
        phone: '+1-800-555-0199',
      })
      .onConflictDoNothing();

    await db
      .insert(actorContactLinks)
      .values({
        linkId: uuid(),
        actorId,
        contactId,
        linkType: 'employee',
        primaryFor: ['purchasing'],
      })
      .onConflictDoNothing();

    // Link products to supplier
    for (const prod of prods) {
      await db
        .insert(productSuppliers)
        .values({
          productSupplierId: uuid(),
          productId: prod.id,
          vendorId,
          supplierPartNumber: `${s.number}-${prod.number}`,
          costPrice: prod.standardCost.toFixed(2),
          isPreferred: true,
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();
    }

    sups.push({ actorId, vendorId, number: s.number, name: s.name });
  }

  // 6. CRM Actors & Customers
  const custConfigs = [
    {
      number: 'CUST-001',
      name: 'Home Hardware Partners LLC',
      address: '4500 N Western Ave',
      city: 'Chicago',
      state: 'IL',
      zip: '60625',
      contactFirst: 'Robert',
      contactLast: 'Sterling',
      email: 'purchasing@homehardware-demo.com',
      creditLimit: '75000.00',
    },
    {
      number: 'CUST-002',
      name: 'BuildIt Retail Stores Inc',
      address: '1200 S Congress Ave',
      city: 'Austin',
      state: 'TX',
      zip: '78704',
      contactFirst: 'Amanda',
      contactLast: 'Clark',
      email: 'ap@buildit-demo.com',
      creditLimit: '120000.00',
    },
    {
      number: 'CUST-003',
      name: 'Apex Commercial Construction',
      address: '3300 E Broadway Rd',
      city: 'Phoenix',
      state: 'AZ',
      zip: '85040',
      contactFirst: 'Carlos',
      contactLast: 'Mendoza',
      email: 'carlos@apexbuilt-demo.com',
      creditLimit: '50000.00',
    },
    {
      number: 'CUST-004',
      name: 'Texas Industrial Builders Group',
      address: '8800 Gulf Fwy',
      city: 'Houston',
      state: 'TX',
      zip: '77017',
      contactFirst: 'Jennifer',
      contactLast: 'Lee',
      email: 'procurement@txbuilders-demo.com',
      creditLimit: '90000.00',
    },
    {
      number: 'CUST-005',
      name: 'Pacific Northwest Contractors',
      address: '2200 4th Ave S',
      city: 'Seattle',
      state: 'WA',
      zip: '98134',
      contactFirst: 'Brian',
      contactLast: 'Oster',
      email: 'orders@pnwcontractors-demo.com',
      creditLimit: '60000.00',
    },
  ];

  const custs: MasterActorCustomer[] = [];

  for (const c of custConfigs) {
    const actorId = uuid();
    const customerId = uuid();

    await db
      .insert(actors)
      .values({
        actorId,
        name: c.name,
        stateCode: ACTOR_STATE.ACTIVE,
        isTaxRegistered: true,
        headquartersAddressLine1: c.address,
        headquartersCity: c.city,
        headquartersStateOrProvince: c.state,
        headquartersPostalCode: c.zip,
        headquartersCountry: 'USA',
        email: c.email,
        telephone: '+1-800-555-0244',
        industry: 'Commercial Construction & Retail',
      })
      .onConflictDoNothing();

    await db
      .insert(customers)
      .values({
        customerId,
        actorId,
        customerNumber: c.number,
        currencyCode: baseCurrency,
        tradingTermsId: termId,
        creditLimit: c.creditLimit,
        stateCode: CUSTOMER_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    await db
      .insert(customerDeliveryAddresses)
      .values({
        id: uuid(),
        customerId,
        addressName: 'Primary Receiving Yard',
        recipientName: `${c.contactFirst} ${c.contactLast}`,
        addressLine1: c.address,
        city: c.city,
        stateOrProvince: c.state,
        postalCode: c.zip,
        country: 'USA',
        isPrimary: true,
        source: 'app',
      })
      .onConflictDoNothing();

    const contactId = uuid();
    await db
      .insert(contacts)
      .values({
        contactId,
        stateCode: CONTACT_STATE.ACTIVE,
        firstName: c.contactFirst,
        lastName: c.contactLast,
        fullName: `${c.contactFirst} ${c.contactLast}`,
        jobTitle: 'Purchasing Manager',
        email: c.email,
        phone: '+1-800-555-0244',
      })
      .onConflictDoNothing();

    await db
      .insert(actorContactLinks)
      .values({
        linkId: uuid(),
        actorId,
        contactId,
        linkType: 'employee',
        primaryFor: ['sales', 'billing'],
      })
      .onConflictDoNothing();

    custs.push({ actorId, customerId, number: c.number, name: c.name });
  }

  // Record Master Data Event
  await db
    .insert(masterDataEvents)
    .values({
      eventId: uuid(),
      entityType: 'seed_master_data',
      entityId: locs[0].id,
      eventType: 'master_data.initialized',
      entityDisplayName: 'Demo Master Data Initialized',
      payload: {
        locationCount: locs.length,
        supplierCount: sups.length,
        customerCount: custs.length,
        productCount: prods.length,
      },
      actor: 'system',
    })
    .onConflictDoNothing();

  console.log('Master data successfully seeded.');
  return { locs, sups, custs, prods, taxCategoryId: taxCatId, baseCurrency };
}

export async function generateTransactions(db: SeedDB, data: MasterData) {
  console.log(
    'Generating historical & active transactions (POs, Receipts, AP Invoices, SOs, Picks, Shipments, AR Invoices)...',
  );

  const now = new Date();
  const oneYearAgo = new Date(
    now.getFullYear() - 1,
    now.getMonth(),
    now.getDate(),
  );

  let poCounter = 1000;
  let rcvCounter = 1000;
  let apInvCounter = 1000;
  let soCounter = 5000;
  const pickCounter = 5000;
  let shpCounter = 5000;
  let arInvCounter = 5000;

  // Track real stock per product per location to prevent negative balance
  const stockLevels: Record<string, number> = {};
  const getStockKey = (binId: string, productId: string) =>
    `${binId}_${productId}`;

  // =========================================================================
  // 1. PURCHASE ORDERS & INBOUND RECEIPTS (20 POs)
  // =========================================================================
  for (let i = 0; i < 20; i++) {
    const poDate = randomDate(oneYearAgo, now);
    const supplier = randomItem(data.sups);
    const location = randomItem(data.locs);
    const poId = uuid();
    const poNumber = `PO-${poCounter++}`;

    // 14 Received/Invoiced, 4 Ordered/Partially Received, 2 Draft
    let poState: PurchaseOrderState = PURCHASE_ORDER_STATE.RECEIVED;
    if (i === 18 || i === 19) {
      poState = PURCHASE_ORDER_STATE.DRAFT;
    } else if (i >= 14) {
      poState = PURCHASE_ORDER_STATE.ORDERED;
    }

    const isReceived = poState === PURCHASE_ORDER_STATE.RECEIVED;
    const isInvoiced = isReceived && i % 2 === 0;

    let poTotalAmount = 0;
    const lineInserts: {
      lineId: string;
      lineNumber: number;
      prod: MasterProduct;
      qty: number;
      price: number;
      lineAmount: number;
      taxAmount: number;
      lineTotal: number;
    }[] = [];

    const numLines = randomInt(2, 5);
    for (let j = 0; j < numLines; j++) {
      const prod = randomItem(data.prods);
      const qty = randomInt(40, 150);
      const price = prod.standardCost;
      const lineAmount = qty * price;
      const taxAmount = Number((lineAmount * 0.1).toFixed(2));
      const lineTotal = lineAmount + taxAmount;

      poTotalAmount += lineTotal;
      lineInserts.push({
        lineId: uuid(),
        lineNumber: j + 1,
        prod,
        qty,
        price,
        lineAmount,
        taxAmount,
        lineTotal,
      });
    }

    await db
      .insert(purchaseOrders)
      .values({
        purchaseOrderId: poId,
        orderNumber: poNumber,
        vendorId: supplier.vendorId,
        deliveryLocationId: location.id,
        stateCode: poState,
        currencyCode: data.baseCurrency,
        exchangeRate: '1',
        baseTotalAmount: poTotalAmount.toFixed(2),
        createdOn: poDate,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    for (const line of lineInserts) {
      await db
        .insert(purchaseOrderLineItems)
        .values({
          purchaseOrderLineId: line.lineId,
          purchaseOrderId: poId,
          lineNumber: line.lineNumber,
          productId: line.prod.id,
          productDescription: line.prod.name,
          quantity: line.qty.toString(),
          pricePerUnit: line.price.toFixed(2),
          discountPercentage: '0',
          amount: line.lineAmount.toFixed(2),
          taxCategoryId: data.taxCategoryId,
          tax: line.taxAmount.toFixed(2),
          totalAmount: line.lineTotal.toFixed(2),
          unitOfMeasure: 'EA',
          quantityReceived: isReceived ? line.qty.toString() : '0',
        })
        .onConflictDoNothing();
    }

    // If Received, record goods_received, inventory_entries, inventory_ledger, bin_contents
    if (isReceived) {
      const goodsReceivedId = uuid();
      const receiptNumber = `RCV-${rcvCounter++}`;

      await db
        .insert(goodsReceived)
        .values({
          goodsReceivedId,
          receiptNumber,
          vendorId: supplier.vendorId,
          locationId: location.id,
          packingSlipNumber: `PS-${poCounter}`,
          stateCode: GOODS_RECEIVED_STATE.RECEIVED,
          createdBy: 'system',
          createdOn: poDate,
        })
        .onConflictDoNothing();

      const entryId = uuid();
      await db
        .insert(inventoryEntries)
        .values({
          entryId,
          entryNumber: `STK-IN-${rcvCounter}`,
          entryDate: poDate,
          memo: `Receipt for ${poNumber} from ${supplier.name}`,
          sourceType: 'PO_RECEIPT',
          sourceId: poId,
          isReversed: false,
          createdBy: 'system',
        })
        .onConflictDoNothing();

      for (const line of lineInserts) {
        await db
          .insert(goodsReceivedLines)
          .values({
            goodsReceivedLineId: uuid(),
            goodsReceivedId,
            productId: line.prod.id,
            quantityReceived: line.qty.toString(),
            unitCost: line.price.toFixed(2),
            matchStatus: MATCH_STATUS.MATCHED,
            putawayStatus: PUTAWAY_STATUS.COMPLETED,
            purchaseOrderId: poId,
            purchaseOrderLineId: line.lineId,
          })
          .onConflictDoNothing();

        // Ledger entry (+qty in storage bin)
        await db
          .insert(inventoryLedger)
          .values({
            ledgerId: uuid(),
            entryId,
            productId: line.prod.id,
            binId: location.storageBinId,
            locationId: location.id,
            zoneId: location.mainZoneId,
            quantity: line.qty.toString(),
          })
          .onConflictDoNothing();

        // Update in-memory stock tracker and bin_contents
        const key = getStockKey(location.storageBinId, line.prod.id);
        stockLevels[key] = (stockLevels[key] || 0) + line.qty;

        await db
          .insert(binContents)
          .values({
            binContentId: uuid(),
            binId: location.storageBinId,
            productId: line.prod.id,
            actualQuantity: stockLevels[key].toString(),
            modifiedOn: poDate,
          })
          .onConflictDoUpdate({
            target: [binContents.binId, binContents.productId],
            set: {
              actualQuantity: stockLevels[key].toString(),
              modifiedOn: poDate,
            },
          });
      }

      // Record Procurement Audit Event
      await db
        .insert(procurementEvents)
        .values({
          eventId: uuid(),
          entityType: 'purchase_order',
          entityId: poId,
          eventType: 'purchase_order.received',
          entityDisplayName: `${poNumber} Received`,
          payload: { orderNumber: poNumber, totalAmount: poTotalAmount },
          actor: 'warehouse',
          createdOn: poDate,
        })
        .onConflictDoNothing();

      // If Invoiced, generate AP purchase_invoices
      if (isInvoiced) {
        const invId = uuid();
        const invNumber = `BILL-${apInvCounter++}`;
        const taxAmount = Number((poTotalAmount * 0.0909).toFixed(2));

        await db
          .insert(purchaseInvoices)
          .values({
            invoiceId: invId,
            invoiceNumber: invNumber,
            vendorId: supplier.vendorId,
            purchaseOrderId: poId,
            supplierInvoiceNumber: `INV-${supplier.number}-${poCounter}`,
            totalAmount: poTotalAmount.toFixed(2),
            outstandingAmount: '0.00',
            taxAmount: taxAmount.toFixed(2),
            baseTotalAmount: poTotalAmount.toFixed(2),
            baseOutstandingAmount: '0.00',
            currencyCode: data.baseCurrency,
            exchangeRate: '1',
            stateCode: PURCHASE_INVOICE_STATE.PAID,
            invoiceDate: poDate,
            dueDate: new Date(poDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            createdBy: 'system',
            createdOn: poDate,
          })
          .onConflictDoNothing();

        for (const line of lineInserts) {
          await db
            .insert(purchaseInvoiceLines)
            .values({
              invoiceLineId: uuid(),
              invoiceId: invId,
              purchaseOrderLineId: line.lineId,
              productId: line.prod.id,
              quantityInvoiced: line.qty.toString(),
              pricePerUnit: line.price.toFixed(2),
              amount: line.lineAmount.toFixed(2),
              matchStatus: MATCH_STATUS.MATCHED,
            })
            .onConflictDoNothing();
        }
      }
    }
  }

  // =========================================================================
  // 2. SALES ORDERS, PICKS, SHIPMENTS & AR INVOICES (40 SOs)
  // =========================================================================
  for (let i = 0; i < 40; i++) {
    const soDate = randomDate(oneYearAgo, now);
    const customer = randomItem(data.custs);
    const location = randomItem(data.locs);
    const soId = uuid();
    const soNumber = `SO-${soCounter++}`;

    // 26 Shipped/Invoiced, 6 Picking, 5 Confirmed, 3 Draft/Quoted
    let soState: SalesOrderState = SALES_ORDER_STATE.SHIPPED;
    if (i >= 37) {
      soState = SALES_ORDER_STATE.DRAFT;
    } else if (i >= 32) {
      soState = SALES_ORDER_STATE.CONFIRMED;
    } else if (i >= 26) {
      soState = SALES_ORDER_STATE.PICKING;
    }

    const isShipped = soState === SALES_ORDER_STATE.SHIPPED;
    const isPicked = isShipped || soState === SALES_ORDER_STATE.PICKING;
    const isInvoiced = isShipped && i % 2 === 0;

    let soTotalAmount = 0;
    const soLineInserts: {
      lineId: string;
      lineNumber: number;
      prod: MasterProduct;
      qty: number;
      price: number;
      unitCost: number;
      lineAmount: number;
      taxAmount: number;
      lineTotal: number;
    }[] = [];

    const numLines = randomInt(1, 4);
    for (let j = 0; j < numLines; j++) {
      const prod = randomItem(data.prods);
      const key = getStockKey(location.storageBinId, prod.id);
      const available = stockLevels[key] || 0;

      // Keep quantities conservative so stock stays strictly positive
      const maxOrder = Math.max(1, Math.min(15, Math.floor(available * 0.3)));
      const qty = randomInt(1, maxOrder);
      const price = prod.listPrice;
      const unitCost = prod.standardCost;
      const lineAmount = qty * price;
      const taxAmount = Number((lineAmount * 0.1).toFixed(2));
      const lineTotal = lineAmount + taxAmount;

      soTotalAmount += lineTotal;
      soLineInserts.push({
        lineId: uuid(),
        lineNumber: j + 1,
        prod,
        qty,
        price,
        unitCost,
        lineAmount,
        taxAmount,
        lineTotal,
      });
    }

    await db
      .insert(salesOrders)
      .values({
        salesOrderId: soId,
        orderNumber: soNumber,
        customerId: customer.customerId,
        customerOrderNumber: `PO-${customer.number}-${soCounter}`,
        fulfillmentLocationId: location.id,
        stateCode: soState,
        currencyCode: data.baseCurrency,
        exchangeRate: '1',
        baseTotalAmount: soTotalAmount.toFixed(2),
        discrepanciesAcknowledged: false,
        source: 'app',
        createdOn: soDate,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    for (const line of soLineInserts) {
      await db
        .insert(salesOrderLineItems)
        .values({
          salesOrderLineId: line.lineId,
          salesOrderId: soId,
          lineNumber: line.lineNumber,
          productId: line.prod.id,
          productDescription: line.prod.name,
          quantity: line.qty.toString(),
          pricePerUnit: line.price.toFixed(2),
          unitCost: line.unitCost.toFixed(2),
          discountPercentage: '0',
          amount: line.lineAmount.toFixed(2),
          taxCategoryId: data.taxCategoryId,
          tax: line.taxAmount.toFixed(2),
          totalAmount: line.lineTotal.toFixed(2),
          unitOfMeasure: 'EA',
          quantityPicked: isPicked ? line.qty.toString() : '0',
          fulfillmentLocationId: location.id,
          isPostConfirmation: false,
        })
        .onConflictDoNothing();
    }

    // Picks
    if (isPicked) {
      for (const line of soLineInserts) {
        await db
          .insert(salesOrderPicks)
          .values({
            pickId: uuid(),
            salesOrderId: soId,
            salesOrderLineId: line.lineId,
            productId: line.prod.id,
            binId: location.storageBinId,
            quantity: line.qty.toString(),
            stateCode: isShipped
              ? SALES_ORDER_PICK_STATE.SHIPPED
              : SALES_ORDER_PICK_STATE.PICKED,
            createdOn: soDate,
            createdBy: 'system',
          })
          .onConflictDoNothing();
      }
    }

    // Shipments, Inventory Deductions & AR Invoices
    if (isShipped) {
      const shipmentId = uuid();
      const shipmentNumber = `SH-${shpCounter++}`;

      await db
        .insert(salesOrderShipments)
        .values({
          shipmentId,
          shipmentNumber,
          salesOrderId: soId,
          stateCode: SHIPMENT_STATE.DISPATCHED,
          fulfillmentLocationId: location.id,
          createdOn: soDate,
          createdBy: 'system',
        })
        .onConflictDoNothing();

      const entryId = uuid();
      await db
        .insert(inventoryEntries)
        .values({
          entryId,
          entryNumber: `STK-OUT-${shpCounter}`,
          entryDate: soDate,
          memo: `Shipment ${shipmentNumber} for order ${soNumber}`,
          sourceType: 'SO_SHIPMENT',
          sourceId: soId,
          isReversed: false,
          createdBy: 'system',
        })
        .onConflictDoNothing();

      for (const line of soLineInserts) {
        await db
          .insert(salesOrderShipmentLines)
          .values({
            shipmentLineId: uuid(),
            shipmentId,
            salesOrderLineId: line.lineId,
            quantityShipped: line.qty.toString(),
          })
          .onConflictDoNothing();

        // Double-entry ledger deduction (-qty)
        await db
          .insert(inventoryLedger)
          .values({
            ledgerId: uuid(),
            entryId,
            productId: line.prod.id,
            binId: location.storageBinId,
            locationId: location.id,
            zoneId: location.mainZoneId,
            quantity: (-line.qty).toString(),
          })
          .onConflictDoNothing();

        // Update in-memory stock and bin_contents
        const key = getStockKey(location.storageBinId, line.prod.id);
        stockLevels[key] = Math.max(0, (stockLevels[key] || 0) - line.qty);

        await db
          .insert(binContents)
          .values({
            binContentId: uuid(),
            binId: location.storageBinId,
            productId: line.prod.id,
            actualQuantity: stockLevels[key].toString(),
            modifiedOn: soDate,
          })
          .onConflictDoUpdate({
            target: [binContents.binId, binContents.productId],
            set: {
              actualQuantity: stockLevels[key].toString(),
              modifiedOn: soDate,
            },
          });
      }

      // Record Sales Audit Event
      await db
        .insert(salesEvents)
        .values({
          eventId: uuid(),
          entityType: 'sales_order',
          entityId: soId,
          eventType: 'sales_order.shipped',
          entityDisplayName: `${soNumber} Shipped to ${customer.name}`,
          payload: { orderNumber: soNumber, totalAmount: soTotalAmount },
          actor: 'sales',
          createdOn: soDate,
        })
        .onConflictDoNothing();

      // If Invoiced, generate AR sales_invoices
      if (isInvoiced) {
        const invId = uuid();
        const invNumber = `INV-${arInvCounter++}`;
        const taxAmount = Number((soTotalAmount * 0.0909).toFixed(2));

        await db
          .insert(salesInvoices)
          .values({
            invoiceId: invId,
            invoiceNumber: invNumber,
            salesOrderId: soId,
            customerId: customer.customerId,
            customerNameDisplay: customer.name,
            totalAmount: soTotalAmount.toFixed(2),
            outstandingAmount: '0.00',
            taxAmount: taxAmount.toFixed(2),
            baseTotalAmount: soTotalAmount.toFixed(2),
            baseOutstandingAmount: '0.00',
            currencyCode: data.baseCurrency,
            exchangeRate: '1',
            stateCode: SALES_INVOICE_STATE.PAID,
            invoiceDate: soDate,
            dueDate: new Date(soDate.getTime() + 30 * 24 * 60 * 60 * 1000),
            createdBy: 'system',
            createdOn: soDate,
          })
          .onConflictDoNothing();

        for (const line of soLineInserts) {
          await db
            .insert(salesInvoiceLines)
            .values({
              invoiceLineId: uuid(),
              invoiceId: invId,
              salesOrderLineId: line.lineId,
              quantityInvoiced: line.qty.toString(),
              pricePerUnit: line.price.toFixed(2),
              amount: line.lineAmount.toFixed(2),
            })
            .onConflictDoNothing();
        }
      }
    }
  }

  // Log inventory event summary
  await db
    .insert(inventoryEvents)
    .values({
      eventId: uuid(),
      entityType: 'inventory_ledger',
      entityId: data.locs[0].id,
      eventType: 'inventory.stock_seeded',
      entityDisplayName: 'Demo Inventory Ledger Initialized',
      payload: { stockEntries: Object.keys(stockLevels).length },
      actor: 'system',
    })
    .onConflictDoNothing();

  console.log('Transactions generated successfully.');
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

export async function runDemoSeeds(db: SeedDB, dryRun = false, force = false) {
  const args = process.argv.slice(2);
  const isForce =
    force ||
    args.includes('--force') ||
    args.includes('-y') ||
    process.env.NODE_ENV === 'test';

  if (!isForce) {
    const confirmed = await confirmExecution();
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }
  try {
    await wipeDatabase(db);

    // Run the framework baseline seeds (Users, App settings, Casbin, Reports)
    await runProdSeeds(db, dryRun);
    await seedCoaAccounts(db, false, 'us_standard');
    await seedCoaSettings(db, false, 'us_standard');

    // Run custom tool distribution seeds
    const data = await seedMasterData(db);
    await generateTransactions(db, data);

    console.log('\nDemo Data Seeding Complete!');
  } catch (e) {
    console.error('Seeding failed:', e);
    throw e;
  }
}
