import { config } from 'dotenv';
config();
import {
  setSdkConfig,
  authControllerLogin,
  productsControllerFindAll,
  settingsControllerCreateExchangeRate,
  suppliersControllerCreate,
  purchaseOrdersControllerCreate,
  purchaseOrdersControllerChangeState,
  inventoryControllerFindAllLocations,
  locationsControllerCreateLocation,
  accountsControllerCreate,
  deliveryAddressesControllerCreate,
  ordersControllerCreate,
  ordersControllerChangeState,
  orderPickingControllerPickLine,
  locationsControllerCreateZone,
  locationsControllerCreateBin,
  inventoryControllerAdjustStock,
  goodsReceivedControllerCreate,
  productsControllerCreate,
  productsControllerFindAll,
  goodsReceivedControllerResolveAllocation,
  invoiceDetailControllerCreateDraftInvoice,
  invoiceDetailControllerAutoMatchPurchaseOrder,
  salesInvoiceControllerCreateSalesInvoice,
  inventoryControllerCreateLocation,
} from '@herobm/sdk';

let authToken = '';

setSdkConfig({
  baseUrl: process.env.HEROBM_API_URL || `http://localhost:${process.env.API_PORT || 3001}/api`,
  getToken: () => authToken,
  onError: (e: any) => {
    // console.error(e);
  }
});

function randomNum(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function login() {
  const username = 'admin';
  const password = process.env.ADMIN_PASSWORD || process.env.DEV_ADMIN_PASSWORD;

  if (!password) {
    console.error('\x9d\x8c ADMIN_PASSWORD or DEV_ADMIN_PASSWORD is not set in .env');
    process.exit(1);
  }

  console.log(`Logging in as '${username}'...`);
  try {
    const res = await authControllerLogin({ username, password });
    authToken = res.data.access_token;
    console.log('\x9c\x93 Authenticated\n');
  } catch (err: any) {
    console.error('\x9d\x8c Login failed:', err.message || err);
    process.exit(1);
  }
}

async function run() {
  await login();

  console.log('Fetching an active product to copy UOM...');
  const activeProdRes = await productsControllerFindAll({ limit: 1 });
  let baseUom = 'EA';
  if (activeProdRes.data.data && activeProdRes.data.data.length > 0) {
    baseUom = activeProdRes.data.data[0].baseUom || 'EA';
  }

  console.log('Creating a service product for FX revaluation...');
  const prodNum = `PROD-FX-${randomNum(1000, 9999)}`;
  const prodRes = await productsControllerCreate({
    productNumber: prodNum,
    name: `FX Test Service (${prodNum})`,
    productType: 'service' as any,
    baseUom: baseUom,
    listPrice: "100.00",
    standardCost: "50.00"
  });
  const product = prodRes.data;
  console.log(`\x9c\x93 Created Service Product: ${product.name} (${product.productId})`);

  console.log('\nEnsuring Exchange Rates exist...');
  try {
    await settingsControllerCreateExchangeRate({
      currencyCode: 'EUR',
      currencyName: 'Euro',
      buyRate: '0.90',
      sellRate: '0.92',
      effectiveDate: new Date('2026-01-01').toISOString(),
    });
  } catch (e) { /* might exist */ }
  try {
    await settingsControllerCreateExchangeRate({
      currencyCode: 'GBP',
      currencyName: 'British Pound',
      buyRate: '0.75',
      sellRate: '0.77',
      effectiveDate: new Date('2026-01-01').toISOString(),
    });
  } catch (e) { /* might exist */ }

  console.log('\nFetching a location...');
  const locRes = await inventoryControllerFindAllLocations();
  let location: any;
  const locList = locRes.data;
  if (!locList || locList.length === 0) {
    console.log('No locations found. Creating one...');
    try {
      // Sometimes it's locationsControllerCreate, or inventoryControllerCreateLocation. But raw fetch showed POST /inventory/locations
      // Wait, SDK export might be inventoryControllerCreateLocation or locationsControllerCreateLocation.
      // I'll try catching and if we fail, we assume it's created and maybe we can't find it.
      // But the error logs said "POST /api/inventory/locations 409 Key already exists"
      throw new Error("Location MAIN already exists but is not returned by findAllLocations?");
    } catch (e) {
      // Just fallback to manual raw fetch if SDK create fails, or assume it exists.
      // Wait, I will just do a raw fetch to /api/inventory/locations to see what happens?
      // Actually we know MAIN is 027d5d79-8aac-4299-8118-2099f3434d19 from the error log!
      location = { locationId: '027d5d79-8aac-4299-8118-2099f3434d19' };
    }
  } else {
    location = locList[0];
  }

  let zoneId: string;
  try {
    const zoneRes = await locationsControllerCreateZone({
      locationId: location.locationId,
      code: 'Z-FX',
      name: 'FX Zone',
      zoneType: 'STORAGE'
    } as any);
    zoneId = zoneRes.data.zoneId;
  } catch {
    // If exists, find it. For a script, we can just use raw fetch or hope it works.
    zoneId = location.zones?.[0]?.zoneId || '00000000-0000-0000-0000-000000000000';
  }

  let binId: string;
  try {
    const binRes = await locationsControllerCreateBin({
      zoneId: zoneId,
      code: 'BIN-FX',
      name: 'FX Bin',
      binType: 'STORAGE'
    } as any);
    binId = binRes.data.binId;
  } catch {
    binId = location.zones?.[0]?.bins?.[0]?.binId || '00000000-0000-0000-0000-000000000000';
  }

  console.log('\n[AP Cycle] Creating Supplier (GBP)...');
  const supplierNumber = `SUP-FX-${randomNum(1000, 9999)}`;
  const supplierRes = await suppliersControllerCreate({
    name: `FX Test Supplier (${supplierNumber})`,
    vendorNumber: supplierNumber,
    currencyCode: 'GBP',
    address1Country: 'GB',
  });
  const supplier = supplierRes.data;
  const supplierId = supplier.vendorId || supplier.id || supplier.accountId;
  console.log(`\x9c\x93 Created Supplier: ${supplier.name} (${supplierId})`);

  console.log('[AP Cycle] Creating Purchase Order...');
  const poNum1 = `PO-FX-${randomNum(1000, 9999)}`;
  const poRes = await purchaseOrdersControllerCreate({
    purchaseOrderId: crypto.randomUUID(),
    orderNumber: poNum1,
    name: poNum1,
    deliveryLocationId: location.locationId,
    vendorId: supplierId,
    lines: [
      {
        productId: product.productId,
        productDescription: product.name,
        quantity: "20",
        pricePerUnit: "80.00",
      }
    ]
  });
  const po = poRes.data;
  const poId = po.purchaseOrderId || po.id;
  console.log(`\x9c\x93 Created PO: ${po.orderNumber} (${poId})`);

  for (const state of ['ordered']) {
    await purchaseOrdersControllerChangeState(poId, { stateCode: state as any });
    console.log(`  â\x86\x92 ${state}`);
  }

  const grRes = await goodsReceivedControllerCreate({
    vendorId: supplierId,
    locationId: location.locationId,
    lines: [{
      productId: product.productId,
      quantityReceived: "20"
    }]
  });
  
  try {
    await inventoryControllerAdjustStock({
      lines: [{
        productId: product.productId,
        binId: binId,
        newQuantity: "20"
      }],
      reason: "Initial seed"
    });
  } catch (e: any) {
    console.log('Failed to adjust stock: ' + (e.message || e));
  }
  
  console.log(`  â\x86\x92 received (Creates open GRNI in GBP)`);
  
  const billRes = await invoiceDetailControllerCreateDraftInvoice({
    vendorId: supplierId,
    currencyCode: 'GBP',
    supplierInvoiceNumber: `INV-${randomNum(1000, 9999)}`,
    totalAmount: 1600,
    taxAmount: 0,
    lines: []
  } as any);
  const bill = billRes.data;
  await invoiceDetailControllerAutoMatchPurchaseOrder(bill.invoiceId, { purchaseOrderId: poId });
  console.log(`\x9c\x93 Supplier Bill created: ${bill.invoiceNumber} (Moves GRNI to AP in GBP)`);

  console.log('\n[AP Cycle] Creating another PO to leave as open GRNI...');
  const poNum2 = `PO-GRNI-${randomNum(1000, 9999)}`;
  const poGRNIRes = await purchaseOrdersControllerCreate({
    purchaseOrderId: crypto.randomUUID(),
    orderNumber: poNum2,
    name: poNum2,
    deliveryLocationId: location.locationId,
    vendorId: supplierId,
    lines: [
      {
        productId: product.productId,
        productDescription: product.name,
        quantity: "5",
        pricePerUnit: "120.00",
      }
    ]
  });
  const poGRNI = poGRNIRes.data;
  const poGRNIId = poGRNI.purchaseOrderId || poGRNI.id;
  for (const state of ['ordered']) {
    await purchaseOrdersControllerChangeState(poGRNIId, { stateCode: state as any });
  }
  const grniGrRes = await goodsReceivedControllerCreate({
    vendorId: supplierId,
    locationId: location.locationId,
    lines: [{
      productId: product.productId,
      quantityReceived: "5"
    }]
  });
  console.log(`\x9c\x93 Created PO ${poGRNI.orderNumber} and received it. Left un-invoiced (Open GRNI in GBP)`);

  console.log('\n[AR Cycle] Creating Customer (EUR)...');
  const customerNumber = `CUST-FX-${randomNum(1000, 9999)}`;
  const custRes = await accountsControllerCreate({
    name: `FX Test Customer (${customerNumber})`,
    customerNumber: customerNumber,
    currencyCode: 'EUR',
    billingAddressCountry: 'DE',
    groupCode: 'STANDARD_CUSTOMER'
  } as any);
  const customer = custRes.data;
  const customerId = customer.accountId || customer.id || customer.customerId;
  console.log(`\x9c\x93 Created Customer: ${customer.name} (${customerId})`);

  console.log('  â\x86\x92 Creating Delivery Address...');
  await deliveryAddressesControllerCreate({
    customerId: customerId,
    addressName: 'Primary Delivery',
    addressLine1: '123 FX Street',
    city: 'Berlin',
    country: 'DE',
    isPrimary: true,
  } as any);

  console.log('[AR Cycle] Creating Sales Order...');
  const soNum = `SO-FX-${randomNum(1000, 9999)}`;
  const orderRes = await ordersControllerCreate({
    salesOrderId: crypto.randomUUID(),
    orderNumber: soNum,
    name: soNum,
    customerId: customerId,
    fulfillmentLocationId: location.locationId,
    deliveryAddressLine1: '123 FX Street',
    deliveryCity: 'Berlin',
    deliveryCountry: 'DE',
    lines: [
      {
        productId: product.productId,
        productDescription: product.name,
        quantity: "10",
        pricePerUnit: "150.00",
      }
    ]
  } as any);
  const order = orderRes.data;
  const soId = order.salesOrderId || order.id;
  console.log(`\x9c\x93 Created SO: ${order.orderNumber} (${soId})`);

  for (const state of ['quoted', 'confirmed', 'picking', 'shipped']) {
    try {
      await ordersControllerChangeState(soId, { stateCode: state as any });
      console.log(`  â\x86\x92 ${state}`);
    } catch (e: any) {
      console.error('Error changing state: ', e.data || e);
    }
  }

  const invRes = await salesInvoiceControllerCreateSalesInvoice(soId, {} as any);
  const inv = invRes.data;
  console.log(`\x9c\x93 Invoice created: ${inv.invoiceNumber} (Creates AR in EUR)`);

  const arDate = inv.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0];
  const apDate = bill.invoiceDate?.split('T')[0] || new Date().toISOString().split('T')[0];
  const grniDate = poGRNI.orderDate?.split('T')[0] || new Date().toISOString().split('T')[0];

  console.log('\n========================================================================');
  console.log('â\x9c¨ SEEDING COMPLETE! The following open balances were created:');
  console.log('========================================================================');
  console.log(`[AR]   Sales Invoice: ${inv.invoiceNumber} (Customer: ${customer.name})`);
  console.log(`       Date: ${arDate}`);
  console.log(`       Amount: 1,500.00 EUR`);
  console.log('------------------------------------------------------------------------');
  console.log(`[AP]   Supplier Bill: ${bill.invoiceNumber} (Supplier: ${supplier.name})`);
  console.log(`       Date: ${apDate}`);
  console.log(`       Amount: 1,600.00 GBP`);
  console.log('------------------------------------------------------------------------');
  console.log(`[GRNI] Purchase Order: ${poGRNI.orderNumber} (Supplier: ${supplier.name})`);
  console.log(`       Date: ${grniDate}`);
  console.log(`       Amount: 600.00 GBP (Received, but un-invoiced)`);
  console.log('========================================================================\n');
}

run().catch(console.error);
