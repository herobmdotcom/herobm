import * as crypto from 'crypto';
import * as readline from 'readline';
import { sql, eq } from 'drizzle-orm';
import {
  uomDictionary,
  productGroups,
  products,
  productComponents,
  productUoms,
  productSuppliers,
  productDefaultBins,
  discountMatrix,
  locations,
  zones,
  bins,
  actors,
  contacts,
  actorContactLinks,
  actorActorLinks,
  actorNotes,
  projects,
  projectActors,
  projectContacts,
  projectNotes,
  customerGroups,
  customers,
  customerDeliveryAddresses,
  suppliers,
  workOrders,
  workOrderComponents,
  workOrderPicks,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderReceipts,
  transferOrderReceiptLines,
  purchaseOrders,
  purchaseOrderLineItems,
  goodsReceived,
  goodsReceivedLines,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseOrderReturnShipmentLines,
  purchaseDebitNotes,
  purchaseDebitNoteLines,
  purchaseDebitNoteShipments,
  salesOrders,
  salesOrderLineItems,
  salesOrderPicks,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesInvoices,
  salesInvoiceLines,
  salesOrderReturns,
  salesOrderReturnLines,
  salesCreditNotes,
  salesCreditNoteLines,
  backorders,
  paymentEntries,
  paymentAllocations,
  paymentLines,
  inventoryEntries,
  inventoryLedger,
  binContents,
  glAccounts,
  glSettings,
  glJournalEntries,
  glJournalLines,
  costCenters,
  activities,
  exchangeRates,
  taxCategories,
  tradingTerms,
  masterDataEvents,
  procurementEvents,
  salesEvents,
  inventoryEvents,
  warehouseEvents,
  financialEvents,
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
  WORK_ORDER_STATE,
  WorkOrderState,
  WORK_ORDER_PICK_STATE,
  TRANSFER_ORDER_STATE,
  TransferOrderState,
  TRANSFER_ORDER_PICK_STATE,
  RETURN_STATE,
  SALES_CREDIT_NOTE_STATE,
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_SHIPMENT_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  BACKORDER_STATE,
  PAYMENT_STATE,
  PAYMENT_TYPE,
  SUPPLIER_STATE,
  CUSTOMER_STATE,
  PRODUCT_STATE,
  ACTOR_STATE,
  CONTACT_STATE,
  PROJECT_STATE,
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
      herobm_core.payment_allocations, herobm_core.payment_lines, herobm_core.payment_entries,
      herobm_core.gl_journal_lines, herobm_core.gl_journal_entries, herobm_core.gl_reconciliations, herobm_core.gl_match_groups,
      herobm_core.inventory_ledger, herobm_core.inventory_entries, herobm_core.bin_contents, herobm_core.product_default_bins,
      herobm_core.transfer_order_receipt_lines, herobm_core.transfer_order_receipts,
      herobm_core.transfer_order_shipment_lines, herobm_core.transfer_order_shipments,
      herobm_core.transfer_order_picks, herobm_core.transfer_order_lines, herobm_core.transfer_orders,
      herobm_core.work_order_picks, herobm_core.work_order_components, herobm_core.work_orders,
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
      herobm_core.exchange_rates,
      herobm_core.tax_position_mappings, herobm_core.tax_positions, herobm_core.tax_categories, herobm_core.trading_terms,
      herobm_core.cost_centers, herobm_core.activities, herobm_core.gl_settings, herobm_core.gl_accounts,
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
  wipBinId: string;
  quarantineBinId: string;
  mainZoneId: string;
  pickZoneId: string;
}

export interface MasterProduct {
  id: string;
  number: string;
  name: string;
  imagePath?: string;
  listPrice: number;
  standardCost: number;
  tradePrice: number;
  productGroupId: string;
  isKit?: boolean;
}

export interface MasterActorSupplier {
  actorId: string;
  vendorId: string;
  number: string;
  name: string;
  currencyCode: string;
}

export interface MasterActorCustomer {
  actorId: string;
  customerId: string;
  number: string;
  name: string;
  customerGroupId: string;
  currencyCode: string;
}

export interface MasterData {
  locs: MasterLocation[];
  sups: MasterActorSupplier[];
  custs: MasterActorCustomer[];
  prods: MasterProduct[];
  kitProds: MasterProduct[];
  taxCategoryId: string;
  baseCurrency: string;
  bankAccountId: string;
  arAccountId: string;
  apAccountId: string;
  salesAccountId: string;
  cogsAccountId: string;
  inventoryAccountId: string;
  costCenterId: string;
  activityId: string;
}

export async function seedMasterData(
  db: SeedDB,
  region = 'us_standard',
): Promise<MasterData> {
  console.log(
    `Seeding Comprehensive Master Data (Region: ${region}) across all domains...`,
  );

  // 1. Resolve Base GL Settings, Dimensions & Accounts
  const glSettingRows = await db.select().from(glSettings).limit(1);
  const baseCurrency =
    glSettingRows[0]?.baseCurrency ||
    (region === 'au_standard' ? 'AUD' : 'USD'); // baseCurrency fallback

  const taxCatRows = await db.select().from(taxCategories).limit(1);
  const taxCatId = taxCatRows[0]?.taxCategoryId;
  if (!taxCatId) {
    throw new Error(
      'Tax categories must be seeded before running master data.',
    );
  }

  const defaultTermRows = await db
    .select()
    .from(tradingTerms)
    .where(eq(tradingTerms.code, 'NET30'))
    .limit(1);
  const termId = defaultTermRows[0]?.tradingTermsId || null;

  // Resolve Key GL Accounts for Transactions
  const allGlAccounts = await db.select().from(glAccounts);
  const findAccount = (codePrefix: string) =>
    allGlAccounts.find((a) => a.accountCode.startsWith(codePrefix))
      ?.glAccountId || allGlAccounts[0]?.glAccountId;

  const bankAccountId = findAccount('1000') || findAccount('1110');
  const arAccountId =
    glSettingRows[0]?.defaultArAccountId ||
    findAccount('1100') ||
    findAccount('1200');
  const apAccountId =
    glSettingRows[0]?.defaultApAccountId ||
    findAccount('2100') ||
    findAccount('2000');
  const salesAccountId =
    glSettingRows[0]?.defaultRevenueAccountId ||
    findAccount('4100') ||
    findAccount('4000');
  const cogsAccountId =
    glSettingRows[0]?.defaultCogsAccountId ||
    findAccount('5100') ||
    findAccount('5000');
  const inventoryAccountId =
    glSettingRows[0]?.defaultInventoryAccountId ||
    findAccount('1300') ||
    findAccount('1400');

  // Resolve Financial Dimensions
  const costCenterRows = await db.select().from(costCenters).limit(1);
  const costCenterId = costCenterRows[0]?.costCenterId || uuid();

  const activityRows = await db.select().from(activities).limit(1);
  const activityId = activityRows[0]?.activityId || uuid();

  // 2. Exchange Rates
  const fxRates = [
    { code: 'USD', name: 'US Dollar', buy: '1.0000', sell: '1.0000' }, // testData
    { code: 'EUR', name: 'Euro', buy: '1.0850', sell: '1.0920' }, // testData
    { code: 'JPY', name: 'Japanese Yen', buy: '0.0068', sell: '0.0070' }, // testData
    { code: 'AUD', name: 'Australian Dollar', buy: '0.6550', sell: '0.6620' }, // testData
    { code: 'GBP', name: 'British Pound', buy: '1.2750', sell: '1.2820' }, // testData
  ];

  for (const fx of fxRates) {
    await db
      .insert(exchangeRates)
      .values({
        exchangeRateId: uuid(),
        currencyCode: fx.code,
        currencyName: fx.name,
        buyRate: fx.buy,
        sellRate: fx.sell,
        effectiveDate: new Date(),
        updatedOn: new Date(),
      })
      .onConflictDoNothing();
  }

  // 3. Locations (Warehouses), Zones, and Bins
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
    const mfgZoneId = uuid();
    const qcZoneId = uuid();

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
        {
          zoneId: mfgZoneId,
          locationId: loc.id,
          code: 'MFG',
          name: 'Light Assembly & WIP Staging',
          source: 'app',
          createdBy: 'system',
        },
        {
          zoneId: qcZoneId,
          locationId: loc.id,
          code: 'QC',
          name: 'Quality Control & Quarantine',
          source: 'app',
          createdBy: 'system',
        },
      ])
      .onConflictDoNothing();

    const storageBinId = uuid();
    const pickBinId = uuid();
    const bulkBinId = uuid();
    const stagingBinId = uuid();
    const wipBinId = uuid();
    const quarantineBinId = uuid();

    await db
      .insert(bins)
      .values([
        {
          binId: storageBinId,
          zoneId: mainZoneId,
          binNumber: `${loc.code}-STR-01`,
          binType: BIN_TYPE.STORAGE,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: pickBinId,
          zoneId: pickZoneId,
          binNumber: `${loc.code}-PCK-01`,
          binType: BIN_TYPE.PICK,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: bulkBinId,
          zoneId: bulkZoneId,
          binNumber: `${loc.code}-BLK-01`,
          binType: BIN_TYPE.BULK,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: stagingBinId,
          zoneId: stagingZoneId,
          binNumber: `${loc.code}-STG-01`,
          binType: BIN_TYPE.STAGING,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: wipBinId,
          zoneId: mfgZoneId,
          binNumber: `${loc.code}-WIP-01`,
          binType: BIN_TYPE.WIP,
          source: 'app',
          createdBy: 'system',
        },
        {
          binId: quarantineBinId,
          zoneId: qcZoneId,
          binNumber: `${loc.code}-QC-01`,
          binType: BIN_TYPE.QUARANTINE,
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
      wipBinId,
      quarantineBinId,
      mainZoneId,
      pickZoneId,
    });
  }

  // 4. Product Groups & UOMs
  const powerToolsGroupId = uuid();
  const handToolsGroupId = uuid();
  const accessoriesGroupId = uuid();
  const kitsGroupId = uuid();

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
      {
        productGroupId: kitsGroupId,
        groupCode: 'KITS-BUNDLES',
        name: 'Assembled Tool Kits & Contractor Bundles',
        salesTaxCategoryId: taxCatId,
        purchaseTaxCategoryId: taxCatId,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(uomDictionary)
    .values([
      { uomCode: 'BOX', description: 'Box of 10 Units' },
      { uomCode: 'SET', description: 'Complete Tool Set' },
      { uomCode: 'KIT', description: 'Manufactured Kit' },
      { uomCode: 'PALLET', description: 'Master Shipping Pallet' },
    ])
    .onConflictDoNothing();

  // 5. Products (Standard + Manufactured Kit BOMs)
  const baseProdConfigs = [
    {
      id: uuid(),
      number: 'TL-1001',
      name: '18V Cordless Hammer Drill',
      imagePath: 'demo/tl-1001.jpg',
      listPrice: 199.99,
      standardCost: 110.0,
      tradePrice: 169.99,
      productGroupId: powerToolsGroupId,
    },
    {
      id: uuid(),
      number: 'TL-1002',
      name: '20V Max Circular Saw 7-1/4"',
      imagePath: 'demo/tl-1002.jpg',
      listPrice: 149.5,
      standardCost: 85.0,
      tradePrice: 129.5,
      productGroupId: powerToolsGroupId,
    },
    {
      id: uuid(),
      number: 'TL-1003',
      name: '4-1/2" Angle Grinder 11 Amp',
      imagePath: 'demo/tl-1003.jpg',
      listPrice: 89.0,
      standardCost: 48.0,
      tradePrice: 75.0,
      productGroupId: powerToolsGroupId,
    },
    {
      id: uuid(),
      number: 'HT-2001',
      name: '16oz Anti-Vibration Claw Hammer',
      imagePath: 'demo/ht-2001.jpg',
      listPrice: 24.99,
      standardCost: 12.0,
      tradePrice: 19.99,
      productGroupId: handToolsGroupId,
    },
    {
      id: uuid(),
      number: 'HT-2002',
      name: '25ft Magnetic Heavy-Duty Tape Measure',
      imagePath: 'demo/ht-2002.jpg',
      listPrice: 15.5,
      standardCost: 7.5,
      tradePrice: 12.5,
      productGroupId: handToolsGroupId,
    },
    {
      id: uuid(),
      number: 'HT-2003',
      name: '10" High-Leverage Adjustable Wrench Pro',
      imagePath: 'demo/ht-2003.jpg',
      listPrice: 29.99,
      standardCost: 14.0,
      tradePrice: 24.0,
      productGroupId: handToolsGroupId,
    },
    {
      id: uuid(),
      number: 'AC-3001',
      name: '18V 5.0Ah Li-Ion High Output Battery Pack',
      imagePath: 'demo/ac-3001.jpg',
      listPrice: 129.0,
      standardCost: 65.0,
      tradePrice: 105.0,
      productGroupId: accessoriesGroupId,
    },
    {
      id: uuid(),
      number: 'AC-3002',
      name: 'Titanium Coated Drill Bit Set 21-Piece',
      imagePath: 'demo/ac-3002.jpg',
      listPrice: 35.0,
      standardCost: 16.0,
      tradePrice: 28.0,
      productGroupId: accessoriesGroupId,
    },
    {
      id: uuid(),
      number: 'AC-3003',
      name: 'Heavy Duty Modular Tool Bag 18"',
      imagePath: 'demo/ac-3003.jpg',
      listPrice: 45.0,
      standardCost: 20.0,
      tradePrice: 36.0,
      productGroupId: accessoriesGroupId,
    },
  ];

  const prods: MasterProduct[] = [];

  for (const p of baseProdConfigs) {
    await db
      .insert(products)
      .values({
        productId: p.id,
        productNumber: p.number,
        name: p.name,
        imagePath: p.imagePath || null,
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

    // Link default bin for each location
    for (const loc of locs) {
      await db
        .insert(productDefaultBins)
        .values({
          productDefaultBinId: uuid(),
          productId: p.id,
          locationId: loc.id,
          binId: loc.pickBinId,
          isPrimaryPerLocation: true,
        })
        .onConflictDoNothing();
    }

    // Add UOM conversions for bulk items
    if (p.number === 'AC-3001' || p.number === 'AC-3002') {
      await db
        .insert(productUoms)
        .values({
          productUomId: uuid(),
          productId: p.id,
          uomCode: 'BOX',
          ratio: '10.0000',
          isSalesDefault: false,
          isPurchaseDefault: true,
        })
        .onConflictDoNothing();
    }

    prods.push(p);
  }

  // Manufactured BOM / Kit Products
  const kitProdConfigs = [
    {
      id: uuid(),
      number: 'KIT-100',
      name: 'Pro Contractor 18V Combo Pack 5-Piece',
      imagePath: 'demo/kit-100.jpg',
      listPrice: 499.99,
      standardCost: 290.0,
      tradePrice: 429.99,
      productGroupId: kitsGroupId,
      isKit: true,
      components: [
        { prodNumber: 'TL-1001', qty: 1 },
        { prodNumber: 'TL-1002', qty: 1 },
        { prodNumber: 'AC-3001', qty: 2 },
        { prodNumber: 'AC-3002', qty: 1 },
        { prodNumber: 'AC-3003', qty: 1 },
      ],
    },
    {
      id: uuid(),
      number: 'KIT-200',
      name: 'Master Woodworking Station Bundle 4-Piece',
      imagePath: 'demo/kit-200.jpg',
      listPrice: 289.99,
      standardCost: 165.0,
      tradePrice: 249.99,
      productGroupId: kitsGroupId,
      isKit: true,
      components: [
        { prodNumber: 'TL-1002', qty: 1 },
        { prodNumber: 'TL-1003', qty: 1 },
        { prodNumber: 'HT-2002', qty: 1 },
        { prodNumber: 'AC-3003', qty: 1 },
      ],
    },
  ];

  const kitProds: MasterProduct[] = [];

  for (const kp of kitProdConfigs) {
    await db
      .insert(products)
      .values({
        productId: kp.id,
        productNumber: kp.number,
        name: kp.name,
        imagePath: kp.imagePath || null,
        baseUom: 'KIT',
        productType: 'inventory',
        structureType: 'kit',
        productGroupId: kp.productGroupId,
        listPrice: kp.listPrice.toFixed(2),
        standardCost: kp.standardCost.toFixed(2),
        tradePrice: kp.tradePrice.toFixed(2),
        salesTaxCategoryId: taxCatId,
        purchaseTaxCategoryId: taxCatId,
        stateCode: PRODUCT_STATE.ACTIVE,
        source: 'app',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    for (const loc of locs) {
      await db
        .insert(productDefaultBins)
        .values({
          productDefaultBinId: uuid(),
          productId: kp.id,
          locationId: loc.id,
          binId: loc.storageBinId,
          isPrimaryPerLocation: true,
        })
        .onConflictDoNothing();
    }

    // Insert BOM Bill of Materials
    for (let seq = 0; seq < kp.components.length; seq++) {
      const compItem = kp.components[seq];
      const child = prods.find((p) => p.number === compItem.prodNumber);
      if (child) {
        await db
          .insert(productComponents)
          .values({
            componentId: uuid(),
            parentProductId: kp.id,
            childProductId: child.id,
            parentQuantity: '1.0000',
            quantity: compItem.qty.toFixed(4),
            sequenceNumber: seq + 1,
            fractionalBehavior: 'allow_fractional',
          })
          .onConflictDoNothing();
      }
    }

    kitProds.push(kp);
  }

  // 6. CRM Actors & Suppliers
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
      currency: baseCurrency,
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
      currency: baseCurrency,
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
      currency: baseCurrency,
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
      currency: baseCurrency,
    },
    {
      number: 'SUP-005',
      name: 'Makita Global Precision Corp (Japan)',
      address: '3-11-8 Sumiyoshi-cho',
      city: 'Anjo',
      state: 'Aichi',
      zip: '446-8502',
      contactFirst: 'Hiroshi',
      contactLast: 'Tanaka',
      email: 'international@makita-japan-demo.com',
      currency: 'JPY',
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
        headquartersCountry: s.currency === 'JPY' ? 'JPN' : 'USA',
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
        currencyCode: s.currency,
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
        jobTitle: 'Commercial Account Executive',
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
        primaryFor: ['purchasing', 'billing'],
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
          costPrice:
            s.currency === 'JPY'
              ? (prod.standardCost * 150).toFixed(2)
              : prod.standardCost.toFixed(2),
          isPreferred: true,
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          createdBy: 'system',
        })
        .onConflictDoNothing();
    }

    sups.push({
      actorId,
      vendorId,
      number: s.number,
      name: s.name,
      currencyCode: s.currency,
    });
  }

  // 7. Customer Groups & Discount Matrix
  const vipGroupId = uuid();
  const govGroupId = uuid();
  const retailGroupId = uuid();

  await db
    .insert(customerGroups)
    .values([
      {
        customerGroupId: vipGroupId,
        groupCode: 'COMMERCIAL-VIP',
        name: 'Commercial Contractors Tier 1 (15% Off)',
        stateCode: CUSTOMER_STATE.ACTIVE,
        tradingTermsId: termId,
        earlyPaymentDiscount: '2.0',
        earlyPaymentDiscountDays: 10,
        isOnCreditHold: false,
      },
      {
        customerGroupId: govGroupId,
        groupCode: 'GOV-INSTITUTIONAL',
        name: 'Government & Public Utilities (10% Off)',
        stateCode: CUSTOMER_STATE.ACTIVE,
        tradingTermsId: termId,
        isOnCreditHold: false,
      },
      {
        customerGroupId: retailGroupId,
        groupCode: 'RETAIL-STANDARD',
        name: 'Standard Retail Accounts',
        stateCode: CUSTOMER_STATE.ACTIVE,
        tradingTermsId: termId,
        isOnCreditHold: false,
      },
    ])
    .onConflictDoNothing();

  // Tier 1 VIP Discount Matrix (15% on Power Tools, 10% on Hand Tools)
  await db
    .insert(discountMatrix)
    .values([
      {
        discountMatrixId: uuid(),
        customerGroupId: vipGroupId,
        productGroupId: powerToolsGroupId,
        discountPercentage: '15.00',
      },
      {
        discountMatrixId: uuid(),
        customerGroupId: vipGroupId,
        productGroupId: handToolsGroupId,
        discountPercentage: '10.00',
      },
      {
        discountMatrixId: uuid(),
        customerGroupId: govGroupId,
        productGroupId: powerToolsGroupId,
        discountPercentage: '10.00',
      },
    ])
    .onConflictDoNothing();

  // 8. CRM Actors & Customers
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
      groupId: vipGroupId,
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
      groupId: vipGroupId,
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
      groupId: govGroupId,
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
      groupId: retailGroupId,
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
      groupId: retailGroupId,
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
        customerGroupId: c.groupId,
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
        jobTitle: 'Purchasing Director',
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

    custs.push({
      actorId,
      customerId,
      number: c.number,
      name: c.name,
      customerGroupId: c.groupId,
      currencyCode: baseCurrency,
    });
  }

  // 9. B2B Actor Relationships & Notes
  if (custs.length >= 2) {
    await db
      .insert(actorActorLinks)
      .values({
        linkId: uuid(),
        sourceActorId: custs[0].actorId,
        targetActorId: custs[1].actorId,
        linkType: 'partner',
      })
      .onConflictDoNothing();

    await db
      .insert(actorNotes)
      .values({
        noteId: uuid(),
        actorId: custs[0].actorId,
        content:
          'Enterprise Account: VIP Discount tier applied with Net 30 terms. Preferred delivery yard at Dock 4.',
      })
      .onConflictDoNothing();
  }

  // 10. Major CRM Construction Projects
  const projectId1 = uuid();
  const projectId2 = uuid();

  await db
    .insert(projects)
    .values([
      {
        projectId: projectId1,
        name: 'Project Metro Rail Expansion 2026',
        status: 'In Progress',
        type: 'Commercial Infrastructure',
        stateCode: PROJECT_STATE.ACTIVE,
      },
      {
        projectId: projectId2,
        name: 'Downtown Commercial Highrise Tower B',
        status: 'Planning',
        type: 'Highrise Construction',
        stateCode: PROJECT_STATE.ACTIVE,
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(projectActors)
    .values([
      {
        projectActorId: uuid(),
        projectId: projectId1,
        actorId: custs[2].actorId, // Apex Construction
        roles: ['General Contractor', 'Primary Builder'],
      },
      {
        projectActorId: uuid(),
        projectId: projectId1,
        actorId: sups[0].actorId, // Milwaukee Tool
        roles: ['Preferred Tool Supplier'],
      },
      {
        projectActorId: uuid(),
        projectId: projectId2,
        actorId: custs[3].actorId, // Texas Builders Group
        roles: ['Structural Subcontractor'],
      },
    ])
    .onConflictDoNothing();

  await db
    .insert(projectNotes)
    .values({
      noteId: uuid(),
      projectId: projectId1,
      content:
        'Phase 1 Tool Deliveries scheduled for West Coast Hub pickup. 20V Max saws and battery packs allocated.',
    })
    .onConflictDoNothing();

  // Record Master Data Audit Event
  await db
    .insert(masterDataEvents)
    .values({
      eventId: uuid(),
      entityType: 'seed_master_data',
      entityId: locs[0].id,
      eventType: 'master_data.initialized',
      entityDisplayName: 'Comprehensive Demo Master Data Initialized',
      payload: {
        locationCount: locs.length,
        supplierCount: sups.length,
        customerCount: custs.length,
        productCount: prods.length + kitProds.length,
        projectCount: 2,
      },
      actor: 'system',
    })
    .onConflictDoNothing();

  console.log('Comprehensive master data successfully seeded.');
  return {
    locs,
    sups,
    custs,
    prods,
    kitProds,
    taxCategoryId: taxCatId,
    baseCurrency,
    bankAccountId,
    arAccountId,
    apAccountId,
    salesAccountId,
    cogsAccountId,
    inventoryAccountId,
    costCenterId,
    activityId,
  };
}

export async function generateTransactions(db: SeedDB, data: MasterData) {
  console.log(
    'Generating end-to-end multi-domain enterprise transactions (BOMs, Work Orders, POs, Returns, Debits, SOs, Credits, Payments, Ledgers, GL Journals)...',
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
  let poRetCounter = 1000;
  let debNoteCounter = 1000;

  let soCounter = 5000;
  let shpCounter = 5000;
  let arInvCounter = 5000;
  let soRetCounter = 5000;
  let crNoteCounter = 5000;

  let toCounter = 1000;
  let toShpCounter = 1000;
  let toRcvCounter = 1000;

  let woCounter = 1000;
  let pmtCounter = 1000;
  let jnlCounter = 1000;

  // Track stock levels to enforce positive inventory invariants
  const stockLevels: Record<string, number> = {};
  const getStockKey = (binId: string, productId: string) =>
    `${binId}_${productId}`;

  // =========================================================================
  // 1. PURCHASE ORDERS & INBOUND RECEIPTS (25 POs)
  // Putaway Distribution:
  // - 15 COMPLETED putaway (in storage bins)
  // - 7 PENDING_PUTAWAY putaway (on receiving dock/staging bin)
  // - 3 QUARANTINED putaway (in QC inspection bin)
  // =========================================================================
  const createdPurchaseInvoices: {
    invoiceId: string;
    poId: string;
    vendorId: string;
    totalAmount: number;
    currencyCode: string;
    date: Date;
    lines: { lineId: string; amount: number; price: number; qty: number }[];
  }[] = [];

  const createdPurchaseOrders: {
    poId: string;
    poNumber: string;
    vendorId: string;
    locationId: string;
    lines: {
      lineId: string;
      prod: MasterProduct;
      qty: number;
      price: number;
    }[];
  }[] = [];

  for (let i = 0; i < 25; i++) {
    const poDate = randomDate(oneYearAgo, now);
    const supplier = randomItem(data.sups);
    // Cycle locations so all warehouses receive inventory
    const location = data.locs[i % data.locs.length];
    const poId = uuid();
    const poNumber = `PO-${poCounter++}`;

    const isReceived = true;
    const poState: PurchaseOrderState = PURCHASE_ORDER_STATE.RECEIVED;

    // Putaway Status Distribution
    let putawayStatus: (typeof PUTAWAY_STATUS)[keyof typeof PUTAWAY_STATUS] =
      PUTAWAY_STATUS.COMPLETED;
    let targetBinId = location.storageBinId;

    if (i >= 15 && i < 22) {
      putawayStatus = PUTAWAY_STATUS.PENDING_PUTAWAY;
      targetBinId = location.stagingBinId;
    } else if (i >= 22) {
      putawayStatus = PUTAWAY_STATUS.QUARANTINED;
      targetBinId = location.quarantineBinId;
    }

    const isInvoiced =
      putawayStatus === PUTAWAY_STATUS.COMPLETED && i % 2 === 0;

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

    // Ensure all base products get healthy inventory seeded across all warehouses
    const numLines = randomInt(2, 4);
    for (let j = 0; j < numLines; j++) {
      const prod = data.prods[(i * 2 + j) % data.prods.length];
      const qty = randomInt(80, 250);
      const price =
        supplier.currencyCode === 'JPY'
          ? prod.standardCost * 150
          : prod.standardCost;
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

    const exchangeRate = supplier.currencyCode === 'JPY' ? '0.0068' : '1';
    const baseTotal = (poTotalAmount * Number(exchangeRate)).toFixed(2);

    await db
      .insert(purchaseOrders)
      .values({
        purchaseOrderId: poId,
        orderNumber: poNumber,
        vendorId: supplier.vendorId,
        deliveryLocationId: location.id,
        stateCode: poState,
        currencyCode: supplier.currencyCode,
        exchangeRate,
        baseTotalAmount: baseTotal,
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
          lineType: 'Product',
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
          quantityReceived: line.qty.toString(),
        })
        .onConflictDoNothing();
    }

    createdPurchaseOrders.push({
      poId,
      poNumber,
      vendorId: supplier.vendorId,
      locationId: location.id,
      lines: lineInserts,
    });

    // Inbound Goods Receipt & Stock Ledger
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
        memo: `Receipt for ${poNumber} from ${supplier.name} (${putawayStatus})`,
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
          putawayStatus,
          purchaseOrderId: poId,
          purchaseOrderLineId: line.lineId,
        })
        .onConflictDoNothing();

      // Ledger Entry (+qty in target bin)
      await db
        .insert(inventoryLedger)
        .values({
          ledgerId: uuid(),
          entryId,
          productId: line.prod.id,
          binId: targetBinId,
          locationId: location.id,
          zoneId: location.mainZoneId,
          quantity: line.qty.toString(),
        })
        .onConflictDoNothing();

      const key = getStockKey(targetBinId, line.prod.id);
      stockLevels[key] = (stockLevels[key] || 0) + line.qty;

      await db
        .insert(binContents)
        .values({
          binContentId: uuid(),
          binId: targetBinId,
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
        payload: {
          orderNumber: poNumber,
          totalAmount: poTotalAmount,
          putawayStatus,
        },
        actor: 'warehouse',
        createdOn: poDate,
      })
      .onConflictDoNothing();

    // AP Purchase Invoices
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
          outstandingAmount: poTotalAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          baseTotalAmount: baseTotal,
          baseOutstandingAmount: baseTotal,
          currencyCode: supplier.currencyCode,
          exchangeRate,
          stateCode: PURCHASE_INVOICE_STATE.INVOICED,
          invoiceDate: poDate,
          dueDate: new Date(poDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          createdBy: 'system',
          createdOn: poDate,
        })
        .onConflictDoNothing();

      const invLines = [];
      for (const line of lineInserts) {
        const invLineId = uuid();
        await db
          .insert(purchaseInvoiceLines)
          .values({
            invoiceLineId: invLineId,
            invoiceId: invId,
            purchaseOrderLineId: line.lineId,
            productId: line.prod.id,
            quantityInvoiced: line.qty.toString(),
            pricePerUnit: line.price.toFixed(2),
            amount: line.lineAmount.toFixed(2),
            matchStatus: MATCH_STATUS.MATCHED,
          })
          .onConflictDoNothing();
        invLines.push({
          lineId: invLineId,
          amount: line.lineAmount,
          price: line.price,
          qty: line.qty,
        });
      }

      createdPurchaseInvoices.push({
        invoiceId: invId,
        poId,
        vendorId: supplier.vendorId,
        totalAmount: poTotalAmount,
        currencyCode: supplier.currencyCode,
        date: poDate,
        lines: invLines,
      });
    }
  }

  // =========================================================================
  // 2. SUPPLIER RETURNS & PURCHASE DEBIT NOTES (3 Returns)
  // =========================================================================
  for (let i = 0; i < Math.min(3, createdPurchaseOrders.length); i++) {
    const po = createdPurchaseOrders[i];
    if (po.lines.length === 0) continue;

    const retId = uuid();
    const retNumber = `PO-RET-${poRetCounter++}`;
    const targetLine = po.lines[0];
    const returnQty = 5;

    await db
      .insert(purchaseOrderReturns)
      .values({
        returnId: retId,
        returnNumber: retNumber,
        purchaseOrderId: po.poId,
        stateCode: PURCHASE_RETURN_STATE.SHIPPED,
        notes: 'Defective batch returned to manufacturer for credit memo.',
        createdBy: 'system',
      })
      .onConflictDoNothing();

    const retLineId = uuid();
    await db
      .insert(purchaseOrderReturnLines)
      .values({
        returnLineId: retLineId,
        returnId: retId,
        purchaseOrderLineId: targetLine.lineId,
        quantityReturned: returnQty.toString(),
        reason: 'Factory Defect - Housing cracked on batch arrival',
        returnFee: '0.00',
      })
      .onConflictDoNothing();

    // Return Shipment
    const retShipmentId = uuid();
    await db
      .insert(purchaseOrderReturnShipments)
      .values({
        shipmentId: retShipmentId,
        shipmentNumber: `PO-SHP-${poRetCounter}`,
        returnId: retId,
        stateCode: PURCHASE_RETURN_SHIPMENT_STATE.DISPATCHED,
        trackingNumber: `RET-FEDEX-${randomInt(100000, 999999)}`,
        fulfillmentLocationId: po.locationId,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    const retShipmentLineId = uuid();
    await db
      .insert(purchaseOrderReturnShipmentLines)
      .values({
        shipmentLineId: retShipmentLineId,
        shipmentId: retShipmentId,
        returnLineId: retLineId,
        quantityShipped: returnQty.toString(),
      })
      .onConflictDoNothing();

    // Purchase Debit Note
    const debNoteId = uuid();
    const debAmount = returnQty * targetLine.price;
    await db
      .insert(purchaseDebitNotes)
      .values({
        debitNoteId: debNoteId,
        debitNoteNumber: `DN-${debNoteCounter++}`,
        supplierReferenceNumber: `CR-${po.poNumber}`,
        returnId: retId,
        purchaseOrderId: po.poId,
        vendorId: po.vendorId,
        totalAmount: debAmount.toFixed(2),
        outstandingAmount: debAmount.toFixed(2),
        baseTotalAmount: debAmount.toFixed(2),
        baseOutstandingAmount: debAmount.toFixed(2),
        currencyCode: data.baseCurrency,
        exchangeRate: '1',
        stateCode: PURCHASE_DEBIT_NOTE_STATE.POSTED,
        notes: `Debit note generated against Return ${retNumber}`,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    const debLineId = uuid();
    await db
      .insert(purchaseDebitNoteLines)
      .values({
        debitNoteLineId: debLineId,
        debitNoteId: debNoteId,
        purchaseOrderLineId: targetLine.lineId,
        quantityInvoiced: returnQty.toString(),
        pricePerUnit: targetLine.price.toFixed(2),
        amount: debAmount.toFixed(2),
      })
      .onConflictDoNothing();

    await db
      .insert(purchaseDebitNoteShipments)
      .values({
        debitNoteShipmentId: uuid(),
        debitNoteLineId: debLineId,
        shipmentLineId: retShipmentLineId,
        quantityCredited: returnQty.toString(),
      })
      .onConflictDoNothing();
  }

  // =========================================================================
  // 3. MANUFACTURING WORK ORDERS & BOM ASSEMBLY (6 Work Orders)
  // - 3 Completed
  // - 2 In-Progress (Pending picks show in Picking Queue)
  // - 1 Planned (Pending picks show in Picking Queue)
  // =========================================================================
  for (let i = 0; i < 6; i++) {
    const kit = data.kitProds[i % data.kitProds.length];
    const location = data.locs[i % data.locs.length];
    const woId = uuid();
    const woNumber = `WO-${woCounter++}`;
    const targetQty = randomInt(5, 15);

    let woState: WorkOrderState = WORK_ORDER_STATE.COMPLETED;
    let completedQty = targetQty;
    if (i === 3 || i === 4) {
      woState = WORK_ORDER_STATE.IN_PROGRESS;
      completedQty = Math.floor(targetQty / 2);
    } else if (i === 5) {
      woState = WORK_ORDER_STATE.PLANNED;
      completedQty = 0;
    }

    const assemblyCost = 15.0;
    const totalCost = (kit.standardCost + assemblyCost) * targetQty;

    await db
      .insert(workOrders)
      .values({
        workOrderId: woId,
        orderNumber: woNumber,
        productId: kit.id,
        targetQuantity: targetQty.toString(),
        completedQuantity: completedQty.toString(),
        locationId: location.id,
        wipBinId: location.wipBinId,
        outputBinId: location.storageBinId,
        stateCode: woState,
        putawayStatus:
          woState === WORK_ORDER_STATE.COMPLETED
            ? PUTAWAY_STATUS.COMPLETED
            : PUTAWAY_STATUS.PENDING_PUTAWAY,
        assemblyCostPerUnit: assemblyCost.toFixed(2),
        additionalCost: '0.00',
        totalCost: totalCost.toFixed(2),
        createdBy: 'mfg_supervisor',
      })
      .onConflictDoNothing();

    // Query parent components for this kit
    const compRows = await db
      .select()
      .from(productComponents)
      .where(eq(productComponents.parentProductId, kit.id));

    for (const comp of compRows) {
      const wocId = uuid();
      const expectedQty = Number(comp.quantity) * targetQty;
      await db
        .insert(workOrderComponents)
        .values({
          workOrderComponentId: wocId,
          workOrderId: woId,
          productId: comp.childProductId,
          expectedQuantity: expectedQty.toString(),
          unitCost: (kit.standardCost * 0.25).toFixed(2),
        })
        .onConflictDoNothing();

      const isPendingPick =
        woState === WORK_ORDER_STATE.PLANNED ||
        woState === WORK_ORDER_STATE.IN_PROGRESS;

      await db
        .insert(workOrderPicks)
        .values({
          pickId: uuid(),
          workOrderId: woId,
          workOrderComponentId: wocId,
          binId: location.storageBinId,
          quantity: expectedQty.toString(),
          stateCode: isPendingPick
            ? WORK_ORDER_PICK_STATE.PENDING
            : WORK_ORDER_PICK_STATE.PICKED,
        })
        .onConflictDoNothing();

      if (woState === WORK_ORDER_STATE.COMPLETED) {
        const rawKey = getStockKey(location.storageBinId, comp.childProductId);
        stockLevels[rawKey] = Math.max(
          0,
          (stockLevels[rawKey] || 0) - expectedQty,
        );
      }
    }

    if (woState === WORK_ORDER_STATE.COMPLETED) {
      const kitKey = getStockKey(location.storageBinId, kit.id);
      stockLevels[kitKey] = (stockLevels[kitKey] || 0) + completedQty;

      await db
        .insert(binContents)
        .values({
          binContentId: uuid(),
          binId: location.storageBinId,
          productId: kit.id,
          actualQuantity: stockLevels[kitKey].toString(),
        })
        .onConflictDoUpdate({
          target: [binContents.binId, binContents.productId],
          set: { actualQuantity: stockLevels[kitKey].toString() },
        });
    }
  }

  // =========================================================================
  // 4. INTER-WAREHOUSE TRANSFER ORDERS (6 Transfer Orders)
  // - 2 Confirmed (Shows in Picking Queue!)
  // - 2 Picking with picked lines (Shows in Shipping Queue!)
  // - 2 Received with receipts (Shows in Putaway Queue!)
  // =========================================================================
  for (let i = 0; i < 6; i++) {
    const toId = uuid();
    const toOrderNumber = `TO-${toCounter++}`;
    const srcLoc = data.locs[i % data.locs.length];
    const destLoc = data.locs[(i + 1) % data.locs.length];
    const prod = data.prods[i % data.prods.length];
    const qty = 10;

    let toState: TransferOrderState = TRANSFER_ORDER_STATE.CONFIRMED;
    if (i >= 2 && i < 4) {
      toState = TRANSFER_ORDER_STATE.PICKING;
    } else if (i >= 4) {
      toState = TRANSFER_ORDER_STATE.RECEIVED;
    }

    await db
      .insert(transferOrders)
      .values({
        transferOrderId: toId,
        orderNumber: toOrderNumber,
        sourceLocationId: srcLoc.id,
        destinationLocationId: destLoc.id,
        stateCode: toState,
        notes: `Stock balancing transfer between ${srcLoc.code} and ${destLoc.code}`,
        shippingNotes: 'Standard priority road freight',
        createdBy: 'logistics_planner',
      })
      .onConflictDoNothing();

    const toLineId = uuid();
    await db
      .insert(transferOrderLines)
      .values({
        transferOrderLineId: toLineId,
        transferOrderId: toId,
        productId: prod.id,
        quantity: qty.toString(),
        quantityShipped:
          toState === TRANSFER_ORDER_STATE.RECEIVED ? qty.toString() : '0',
        quantityReceived:
          toState === TRANSFER_ORDER_STATE.RECEIVED ? qty.toString() : '0',
      })
      .onConflictDoNothing();

    // If picking or received, insert transfer pick
    if (
      toState === TRANSFER_ORDER_STATE.PICKING ||
      toState === TRANSFER_ORDER_STATE.RECEIVED
    ) {
      const pickId = uuid();
      await db
        .insert(transferOrderPicks)
        .values({
          pickId,
          transferOrderId: toId,
          transferOrderLineId: toLineId,
          productId: prod.id,
          binId: srcLoc.storageBinId,
          quantity: qty.toString(),
          stateCode: TRANSFER_ORDER_PICK_STATE.PICKED,
          createdBy: 'warehouse_picker',
        })
        .onConflictDoNothing();

      if (toState === TRANSFER_ORDER_STATE.RECEIVED) {
        const toShpId = uuid();
        await db
          .insert(transferOrderShipments)
          .values({
            shipmentId: toShpId,
            transferOrderId: toId,
            shipmentNumber: `TO-SHP-${toShpCounter++}`,
            trackingNumber: `TRK-TO-${randomInt(10000, 99999)}`,
            stateCode: SHIPMENT_STATE.RECEIVED,
            shippedBy: 'dispatch_lead',
          })
          .onConflictDoNothing();

        await db
          .insert(transferOrderShipmentLines)
          .values({
            shipmentLineId: uuid(),
            shipmentId: toShpId,
            transferOrderLineId: toLineId,
            pickId,
            productId: prod.id,
            quantity: qty.toString(),
          })
          .onConflictDoNothing();

        // Inbound Transfer Receipt (Shows in Putaway Queue!)
        const toRcvId = uuid();
        const toPutawayStatus =
          i === 5 ? PUTAWAY_STATUS.QUARANTINED : PUTAWAY_STATUS.PENDING_PUTAWAY;
        await db
          .insert(transferOrderReceipts)
          .values({
            receiptId: toRcvId,
            transferOrderId: toId,
            receiptNumber: `TO-RCV-${toRcvCounter++}`,
            stateCode: TRANSFER_ORDER_STATE.RECEIVED,
            receivedBy: 'dock_receiver',
          })
          .onConflictDoNothing();

        await db
          .insert(transferOrderReceiptLines)
          .values({
            receiptLineId: uuid(),
            receiptId: toRcvId,
            transferOrderLineId: toLineId,
            productId: prod.id,
            binId:
              toPutawayStatus === PUTAWAY_STATUS.QUARANTINED
                ? destLoc.quarantineBinId
                : destLoc.stagingBinId,
            quantity: qty.toString(),
            putawayStatus: toPutawayStatus,
          })
          .onConflictDoNothing();
      }
    }
  }

  // =========================================================================
  // 5. SALES ORDERS & COMPREHENSIVE QUEUE GENERATION (70 SOs)
  // - 35 Historical Shipped & Invoiced Orders (Dispatched)
  // - 12 Picking READY Orders (All items in-stock, unpicked)
  // - 6 Picking PARTIAL Orders (1 in-stock item, 1 out-of-stock item)
  // - 4 Picking BLOCKED Orders (0 in-stock items)
  // - 9 Shipping READY Orders (All lines fully picked, 0 shipped)
  // - 4 Shipping PARTIAL Orders (1 line picked, 1 line unpicked, 0 shipped)
  // =========================================================================
  const createdSalesInvoices: {
    invoiceId: string;
    soId: string;
    customerId: string;
    customerName: string;
    totalAmount: number;
    currencyCode: string;
    date: Date;
    lines: {
      lineId: string;
      amount: number;
      price: number;
      qty: number;
      soLineId: string;
    }[];
  }[] = [];

  const createdSalesOrders: {
    soId: string;
    soNumber: string;
    customerId: string;
    locationId: string;
    lines: {
      lineId: string;
      prod: MasterProduct;
      qty: number;
      price: number;
    }[];
  }[] = [];

  const allAvailableProducts = [...data.prods, ...data.kitProds];

  // Helper to insert a sales order with controlled queue behavior
  async function createCustomSalesOrder(options: {
    scenario:
      | 'shipped'
      | 'picking_ready'
      | 'picking_partial'
      | 'picking_blocked'
      | 'shipping_ready'
      | 'shipping_partial';
    location: MasterLocation;
    customer: MasterActorCustomer;
  }) {
    const { scenario, location, customer } = options;
    const soId = uuid();
    const soNumber = `SO-${soCounter++}`;
    const soDate = randomDate(oneYearAgo, now);

    let soState: SalesOrderState = SALES_ORDER_STATE.SHIPPED;
    if (
      scenario === 'picking_ready' ||
      scenario === 'picking_partial' ||
      scenario === 'picking_blocked'
    ) {
      soState = SALES_ORDER_STATE.CONFIRMED;
    } else if (
      scenario === 'shipping_ready' ||
      scenario === 'shipping_partial'
    ) {
      soState = SALES_ORDER_STATE.PICKING;
    }

    // Configure line items based on scenario
    const linesToInsert: {
      prod: MasterProduct;
      qty: number;
      pickedQty: number;
      isPicked: boolean;
    }[] = [];

    if (scenario === 'shipped') {
      const prod = randomItem(allAvailableProducts);
      linesToInsert.push({ prod, qty: 5, pickedQty: 5, isPicked: true });
    } else if (scenario === 'picking_ready') {
      // 2 lines with stocked items
      linesToInsert.push({
        prod: data.prods[0],
        qty: 3,
        pickedQty: 0,
        isPicked: false,
      });
      linesToInsert.push({
        prod: data.prods[1],
        qty: 2,
        pickedQty: 0,
        isPicked: false,
      });
    } else if (scenario === 'picking_partial') {
      // 1 stocked item + 1 high quantity item exceeding available stock
      linesToInsert.push({
        prod: data.prods[0],
        qty: 2,
        pickedQty: 0,
        isPicked: false,
      });
      linesToInsert.push({
        prod: data.prods[2],
        qty: 9999,
        pickedQty: 0,
        isPicked: false,
      });
    } else if (scenario === 'picking_blocked') {
      // High quantities on all lines that cannot be satisfied
      linesToInsert.push({
        prod: data.prods[1],
        qty: 8888,
        pickedQty: 0,
        isPicked: false,
      });
      linesToInsert.push({
        prod: data.prods[2],
        qty: 9999,
        pickedQty: 0,
        isPicked: false,
      });
    } else if (scenario === 'shipping_ready') {
      // All lines fully picked, ready for dispatch
      linesToInsert.push({
        prod: data.prods[0],
        qty: 4,
        pickedQty: 4,
        isPicked: true,
      });
      linesToInsert.push({
        prod: data.prods[3],
        qty: 6,
        pickedQty: 6,
        isPicked: true,
      });
    } else if (scenario === 'shipping_partial') {
      // Line 1 picked, Line 2 not picked
      linesToInsert.push({
        prod: data.prods[0],
        qty: 5,
        pickedQty: 5,
        isPicked: true,
      });
      linesToInsert.push({
        prod: data.prods[4],
        qty: 5,
        pickedQty: 0,
        isPicked: false,
      });
    }

    let soTotalAmount = 0;
    const soLineInserts: {
      lineId: string;
      lineNumber: number;
      prod: MasterProduct;
      qty: number;
      pickedQty: number;
      isPicked: boolean;
      price: number;
      unitCost: number;
      lineAmount: number;
      taxAmount: number;
      lineTotal: number;
    }[] = [];

    for (let j = 0; j < linesToInsert.length; j++) {
      const item = linesToInsert[j];
      const price = item.prod.listPrice;
      const unitCost = item.prod.standardCost;
      const lineAmount = item.qty * price;
      const taxAmount = Number((lineAmount * 0.1).toFixed(2));
      const lineTotal = lineAmount + taxAmount;

      soTotalAmount += lineTotal;
      soLineInserts.push({
        lineId: uuid(),
        lineNumber: j + 1,
        prod: item.prod,
        qty: item.qty,
        pickedQty: item.pickedQty,
        isPicked: item.isPicked,
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
        createdBy: 'sales_rep',
      })
      .onConflictDoNothing();

    for (const line of soLineInserts) {
      await db
        .insert(salesOrderLineItems)
        .values({
          salesOrderLineId: line.lineId,
          salesOrderId: soId,
          lineNumber: line.lineNumber,
          lineType: 'Product',
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
          unitOfMeasure: line.prod.isKit ? 'KIT' : 'EA',
          quantityPicked: line.pickedQty.toString(),
          fulfillmentLocationId: location.id,
          isPostConfirmation: false,
        })
        .onConflictDoNothing();

      // Insert picks if picked
      if (line.isPicked && line.pickedQty > 0) {
        await db
          .insert(salesOrderPicks)
          .values({
            pickId: uuid(),
            salesOrderId: soId,
            salesOrderLineId: line.lineId,
            productId: line.prod.id,
            binId: location.storageBinId,
            quantity: line.pickedQty.toString(),
            stateCode:
              scenario === 'shipped'
                ? SALES_ORDER_PICK_STATE.SHIPPED
                : SALES_ORDER_PICK_STATE.PICKED,
            createdOn: soDate,
            createdBy: 'warehouse_picker',
          })
          .onConflictDoNothing();
      }
    }

    createdSalesOrders.push({
      soId,
      soNumber,
      customerId: customer.customerId,
      locationId: location.id,
      lines: soLineInserts,
    });

    // Shipments & AR Invoices for historical shipped orders
    if (scenario === 'shipped') {
      const shipmentId = uuid();
      const shipmentNumber = `SH-${shpCounter++}`;

      await db
        .insert(salesOrderShipments)
        .values({
          shipmentId,
          shipmentNumber,
          salesOrderId: soId,
          stateCode: SHIPMENT_STATE.DISPATCHED,
          deliveryCompanyName: 'FedEx Freight Direct',
          trackingNumber: `FDX-${randomInt(10000000, 99999999)}`,
          fulfillmentLocationId: location.id,
          createdOn: soDate,
          createdBy: 'dispatch_lead',
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

      // AR Sales Invoices
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
          outstandingAmount: soTotalAmount.toFixed(2),
          taxAmount: taxAmount.toFixed(2),
          baseTotalAmount: soTotalAmount.toFixed(2),
          baseOutstandingAmount: soTotalAmount.toFixed(2),
          currencyCode: data.baseCurrency,
          exchangeRate: '1',
          stateCode: SALES_INVOICE_STATE.INVOICED,
          invoiceDate: soDate,
          dueDate: new Date(soDate.getTime() + 30 * 24 * 60 * 60 * 1000),
          createdBy: 'billing_clerk',
          createdOn: soDate,
        })
        .onConflictDoNothing();

      const invLines = [];
      for (const line of soLineInserts) {
        const invLineId = uuid();
        await db
          .insert(salesInvoiceLines)
          .values({
            invoiceLineId: invLineId,
            invoiceId: invId,
            salesOrderLineId: line.lineId,
            quantityInvoiced: line.qty.toString(),
            pricePerUnit: line.price.toFixed(2),
            amount: line.lineAmount.toFixed(2),
          })
          .onConflictDoNothing();
        invLines.push({
          lineId: invLineId,
          amount: line.lineAmount,
          price: line.price,
          qty: line.qty,
          soLineId: line.lineId,
        });
      }

      createdSalesInvoices.push({
        invoiceId: invId,
        soId,
        customerId: customer.customerId,
        customerName: customer.name,
        totalAmount: soTotalAmount,
        currencyCode: data.baseCurrency,
        date: soDate,
        lines: invLines,
      });
    }
  }

  // 1. Generate 35 Historical Shipped & Invoiced Orders
  for (let i = 0; i < 35; i++) {
    await createCustomSalesOrder({
      scenario: 'shipped',
      location: data.locs[i % data.locs.length],
      customer: data.custs[i % data.custs.length],
    });
  }

  // 2. Generate 12 Picking Ready Orders (4 per location)
  for (let i = 0; i < 12; i++) {
    await createCustomSalesOrder({
      scenario: 'picking_ready',
      location: data.locs[i % data.locs.length],
      customer: data.custs[i % data.custs.length],
    });
  }

  // 3. Generate 6 Picking Partial Orders (2 per location)
  for (let i = 0; i < 6; i++) {
    await createCustomSalesOrder({
      scenario: 'picking_partial',
      location: data.locs[i % data.locs.length],
      customer: data.custs[i % data.custs.length],
    });
  }

  // 4. Generate 4 Picking Blocked Orders
  for (let i = 0; i < 4; i++) {
    await createCustomSalesOrder({
      scenario: 'picking_blocked',
      location: data.locs[i % data.locs.length],
      customer: data.custs[i % data.custs.length],
    });
  }

  // 5. Generate 9 Shipping Ready Orders (3 per location)
  for (let i = 0; i < 9; i++) {
    await createCustomSalesOrder({
      scenario: 'shipping_ready',
      location: data.locs[i % data.locs.length],
      customer: data.custs[i % data.custs.length],
    });
  }

  // 6. Generate 4 Shipping Partial Orders
  for (let i = 0; i < 4; i++) {
    await createCustomSalesOrder({
      scenario: 'shipping_partial',
      location: data.locs[i % data.locs.length],
      customer: data.custs[i % data.custs.length],
    });
  }

  // =========================================================================
  // 6. SALES RETURNS & SALES CREDIT NOTES (4 Returns)
  // - 2 PENDING_PUTAWAY putaway status (Shows in Putaway Queue!)
  // - 2 QUARANTINED putaway status (Shows in Putaway Queue!)
  // =========================================================================
  for (let i = 0; i < Math.min(4, createdSalesOrders.length); i++) {
    const so = createdSalesOrders[i];
    if (so.lines.length === 0) continue;

    const retId = uuid();
    const retNumber = `SO-RET-${soRetCounter++}`;
    const targetLine = so.lines[0];
    const returnQty = 2;
    const putawayStatus =
      i >= 2 ? PUTAWAY_STATUS.QUARANTINED : PUTAWAY_STATUS.PENDING_PUTAWAY;

    await db
      .insert(salesOrderReturns)
      .values({
        returnId: retId,
        returnNumber: retNumber,
        salesOrderId: so.soId,
        stateCode: RETURN_STATE.RECEIVED,
        locationId: so.locationId,
        notes: `Customer return (${putawayStatus}) for inspection and restock.`,
        createdBy: 'customer_service',
      })
      .onConflictDoNothing();

    await db
      .insert(salesOrderReturnLines)
      .values({
        returnLineId: uuid(),
        returnId: retId,
        salesOrderLineId: targetLine.lineId,
        quantityReturned: returnQty.toString(),
        quantityReceived: returnQty.toString(),
        reason: 'Over-ordered on project work package',
        resolution: 'refund',
        returnFee: '0.00',
        putawayStatus,
        productNumber: targetLine.prod.number,
        productName: targetLine.prod.name,
        pricePerUnit: targetLine.price.toFixed(2),
        discountPercentage: '0.00',
        taxCategoryId: data.taxCategoryId,
      })
      .onConflictDoNothing();

    // Sales Credit Note
    const crNoteId = uuid();
    const crAmount = returnQty * targetLine.price;
    await db
      .insert(salesCreditNotes)
      .values({
        creditNoteId: crNoteId,
        creditNoteNumber: `CN-${crNoteCounter++}`,
        customerId: so.customerId,
        returnId: retId,
        salesOrderId: so.soId,
        totalAmount: crAmount.toFixed(2),
        outstandingAmount: crAmount.toFixed(2),
        baseTotalAmount: crAmount.toFixed(2),
        baseOutstandingAmount: crAmount.toFixed(2),
        currencyCode: data.baseCurrency,
        exchangeRate: '1',
        stateCode: SALES_CREDIT_NOTE_STATE.POSTED,
        notes: `Credit memo issued for return ${retNumber}`,
        createdBy: 'system',
      })
      .onConflictDoNothing();

    await db
      .insert(salesCreditNoteLines)
      .values({
        creditNoteLineId: uuid(),
        creditNoteId: crNoteId,
        salesOrderLineId: targetLine.lineId,
        quantityCredited: returnQty.toString(),
        pricePerUnit: targetLine.price.toFixed(2),
        amount: crAmount.toFixed(2),
        productNumber: targetLine.prod.number,
        productName: targetLine.prod.name,
      })
      .onConflictDoNothing();
  }

  // =========================================================================
  // 7. BACKORDER ALLOCATIONS (5 Backorders)
  // =========================================================================
  for (let i = 0; i < Math.min(5, createdSalesOrders.length); i++) {
    const so = createdSalesOrders[i];
    if (so.lines.length === 0) continue;
    const line = so.lines[0];

    await db
      .insert(backorders)
      .values({
        backorderId: uuid(),
        salesOrderId: so.soId,
        salesOrderLineId: line.lineId,
        productId: line.prod.id,
        quantity: '5.00',
        stateCode: BACKORDER_STATE.AWAITING_RECEIPT,
      })
      .onConflictDoNothing();
  }

  // =========================================================================
  // 8. TREASURY, CASH FLOW & MULTI-ALLOCATION PAYMENTS (AR/AP)
  // =========================================================================
  // Customer Receipts against AR Invoices
  for (let i = 0; i < Math.min(10, createdSalesInvoices.length); i++) {
    const inv = createdSalesInvoices[i];
    const pmtId = uuid();
    const pmtNumber = `RCPT-${pmtCounter++}`;
    const pmtAmount = inv.totalAmount;

    await db
      .insert(paymentEntries)
      .values({
        paymentId: pmtId,
        paymentNumber: pmtNumber,
        paymentType: PAYMENT_TYPE.CUSTOMER_RECEIPT,
        partyId: inv.customerId,
        paymentDate: inv.date,
        modeOfPayment: 'Direct Wire / ACH',
        totalAmount: pmtAmount.toFixed(2),
        unallocatedAmount: '0.00',
        glAccountBank: data.bankAccountId,
        referenceNumber: `ACH-CUST-${pmtCounter}`,
        stateCode: PAYMENT_STATE.SUBMITTED,
        baseTotalAmount: pmtAmount.toFixed(2),
        baseUnallocatedAmount: '0.00',
        currencyCode: inv.currencyCode,
        exchangeRate: '1',
        createdBy: 'finance_ar',
      })
      .onConflictDoNothing();

    await db
      .insert(paymentLines)
      .values({
        paymentLineId: uuid(),
        paymentId: pmtId,
        glAccountId: data.arAccountId,
        amount: pmtAmount.toFixed(2),
        memo: `AR Payment Allocation for ${inv.invoiceId}`,
      })
      .onConflictDoNothing();

    await db
      .insert(paymentAllocations)
      .values({
        allocationId: uuid(),
        paymentId: pmtId,
        referenceType: 'sales_invoice',
        referenceId: inv.invoiceId,
        allocatedAmount: pmtAmount.toFixed(2),
        discountAmount: '0.00',
      })
      .onConflictDoNothing();

    // Mark invoice as PAID
    await db
      .update(salesInvoices)
      .set({
        stateCode: SALES_INVOICE_STATE.PAID,
        outstandingAmount: '0.00',
        baseOutstandingAmount: '0.00',
      })
      .where(eq(salesInvoices.invoiceId, inv.invoiceId));
  }

  // Supplier Disbursements against AP Invoices
  for (let i = 0; i < Math.min(6, createdPurchaseInvoices.length); i++) {
    const inv = createdPurchaseInvoices[i];
    const pmtId = uuid();
    const pmtNumber = `PMT-${pmtCounter++}`;
    const pmtAmount = inv.totalAmount;

    await db
      .insert(paymentEntries)
      .values({
        paymentId: pmtId,
        paymentNumber: pmtNumber,
        paymentType: PAYMENT_TYPE.SUPPLIER_PAYMENT,
        partyId: inv.vendorId,
        paymentDate: inv.date,
        modeOfPayment: 'Electronic Bank Transfer',
        totalAmount: pmtAmount.toFixed(2),
        unallocatedAmount: '0.00',
        glAccountBank: data.bankAccountId,
        referenceNumber: `EFT-SUP-${pmtCounter}`,
        stateCode: PAYMENT_STATE.SUBMITTED,
        baseTotalAmount: pmtAmount.toFixed(2),
        baseUnallocatedAmount: '0.00',
        currencyCode: inv.currencyCode,
        exchangeRate: inv.currencyCode === 'JPY' ? '0.0068' : '1',
        createdBy: 'finance_ap',
      })
      .onConflictDoNothing();

    await db
      .insert(paymentLines)
      .values({
        paymentLineId: uuid(),
        paymentId: pmtId,
        glAccountId: data.apAccountId,
        amount: pmtAmount.toFixed(2),
        memo: `AP Supplier Payment for Invoice ${inv.invoiceId}`,
      })
      .onConflictDoNothing();

    await db
      .insert(paymentAllocations)
      .values({
        allocationId: uuid(),
        paymentId: pmtId,
        referenceType: 'purchase_invoice',
        referenceId: inv.invoiceId,
        allocatedAmount: pmtAmount.toFixed(2),
        discountAmount: '0.00',
      })
      .onConflictDoNothing();

    // Mark AP invoice as PAID
    await db
      .update(purchaseInvoices)
      .set({
        stateCode: PURCHASE_INVOICE_STATE.PAID,
        outstandingAmount: '0.00',
        baseOutstandingAmount: '0.00',
      })
      .where(eq(purchaseInvoices.invoiceId, inv.invoiceId));
  }

  // =========================================================================
  // 9. GENERAL LEDGER JOURNALS & DIMENSION POSTINGS
  // =========================================================================
  for (let i = 0; i < 5; i++) {
    const jnlId = uuid();
    const jnlNumber = `JE-2026-${jnlCounter++}`;
    const jnlDate = randomDate(oneYearAgo, now);
    const amount = randomInt(500, 2500);

    await db
      .insert(glJournalEntries)
      .values({
        journalEntryId: jnlId,
        entryNumber: jnlNumber,
        entryDate: jnlDate.toISOString().split('T')[0],
        memo: `Operating Overhead Allocation & Monthly Warehouse Utilities #${jnlCounter}`,
        sourceType: 'adjustment',
        isReversed: false,
        createdBy: 'chief_accountant',
      })
      .onConflictDoNothing();

    // Debit Expense / Overhead
    await db
      .insert(glJournalLines)
      .values({
        journalLineId: uuid(),
        journalEntryId: jnlId,
        glAccountId: data.cogsAccountId,
        debit: amount.toFixed(2),
        credit: '0.00',
        foreignDebit: amount.toFixed(2),
        foreignCredit: '0.00',
        isReconciled: true,
        costCenterId: data.costCenterId,
        activityId: data.activityId,
        memo: 'Facility power & machinery maintenance debit',
      })
      .onConflictDoNothing();

    // Credit Cash / Bank
    await db
      .insert(glJournalLines)
      .values({
        journalLineId: uuid(),
        journalEntryId: jnlId,
        glAccountId: data.bankAccountId,
        debit: '0.00',
        credit: amount.toFixed(2),
        foreignDebit: '0.00',
        foreignCredit: amount.toFixed(2),
        isReconciled: true,
        costCenterId: data.costCenterId,
        activityId: data.activityId,
        memo: 'Operating account payment credit',
      })
      .onConflictDoNothing();
  }

  // Log Financial & Warehouse Audit Events
  await db
    .insert(financialEvents)
    .values({
      eventId: uuid(),
      entityType: 'payment_entry',
      entityId: data.bankAccountId,
      eventType: 'treasury.payments_processed',
      entityDisplayName: 'Demo Treasury & Cash Flow Processed',
      payload: {
        customerReceipts: 10,
        supplierPayments: 6,
        journalAdjustments: 5,
      },
      actor: 'finance_treasury',
    })
    .onConflictDoNothing();

  await db
    .insert(warehouseEvents)
    .values({
      eventId: uuid(),
      entityType: 'work_orders',
      entityId: data.locs[0].id,
      eventType: 'manufacturing.work_orders_completed',
      entityDisplayName: 'Demo Assembly Work Orders Completed',
      payload: { workOrdersCount: 6 },
      actor: 'mfg_supervisor',
    })
    .onConflictDoNothing();

  await db
    .insert(inventoryEvents)
    .values({
      eventId: uuid(),
      entityType: 'inventory_ledger',
      entityId: data.locs[0].id,
      eventType: 'inventory.stock_seeded',
      entityDisplayName: 'Demo Full Inventory Ledger Initialized',
      payload: { stockEntries: Object.keys(stockLevels).length },
      actor: 'system',
    })
    .onConflictDoNothing();

  console.log('Multi-domain enterprise transactions generated successfully.');
}

async function confirmExecution(): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(
      'WARNING: This will WIPE the database and populate full enterprise demo data! Are you sure you want to proceed? [y/N] ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'y');
      },
    );
  });
}

export async function runDemoSeeds(
  db: SeedDB,
  dryRun = false,
  force = false,
  coaRegion?: string,
) {
  const args = process.argv.slice(2);
  const isForce =
    force ||
    args.includes('--force') ||
    args.includes('-y') ||
    process.env.NODE_ENV === 'test';

  const coaArg = args.find((a) => a.startsWith('--coa='));
  const region = coaRegion || (coaArg ? coaArg.split('=')[1] : 'us_standard');

  if (!isForce) {
    const confirmed = await confirmExecution();
    if (!confirmed) {
      console.log('Aborted.');
      process.exit(0);
    }
  }
  try {
    await wipeDatabase(db);

    // 1. Run the framework baseline seeds (Users, App settings, Casbin, Reports)
    await runProdSeeds(db, dryRun);
    await seedCoaAccounts(db, false, region);
    await seedCoaSettings(db, false, region);

    // 2. Run custom multi-domain distribution seeds
    const data = await seedMasterData(db, region);
    await generateTransactions(db, data);

    console.log(`\nDemo Data Seeding Complete (COA Region: ${region})!`);
  } catch (e) {
    console.error('Seeding failed:', e);
    throw e;
  }
}
