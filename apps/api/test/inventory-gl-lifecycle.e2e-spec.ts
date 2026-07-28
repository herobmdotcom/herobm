import { TestingModule } from '@nestjs/testing';
import { createE2eModule, setupE2eApp } from './utils/e2e-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { register } from 'prom-client';
import request from 'supertest';
import * as crypto from 'crypto';
import { eq, sql, and } from 'drizzle-orm';
import {
  glAccounts,
  bins,
  zones,
  purchaseInvoiceReceipts,
  purchaseInvoiceLines,
  customers,
  suppliers,
} from '../src/drizzle/schema';
import { DRIZZLE } from '../src/drizzle/drizzle.module';

describe('Inventory & GL Lifecycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let vendorId: string;
  let customerId: string;
  let productId: string;
  let productNumber: string;
  let locationId: string;
  let baseCurrency: string;
  let bankAccountId: string;

  // GL Accounts needed for verification
  let accounts: Record<string, string> = {};

  // Cross-step data
  let salesInvoiceId: string;
  let receiptLineId: string;

  beforeAll(async () => {
    register.clear();

    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    setupE2eApp(app);
    await app.init();

    // 1. Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = loginRes.body.access_token;

    // 2. Fetch Master Data
    const customers = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    customerId = customers.body.data[0].customerId;

    console.log('Setup: Getting vendors...');
    const vendors = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = vendors.body.data[0].vendorId;

    console.log('Setup: Getting locations...');
    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const mainLoc =
      locations.body.find((l: any) => l.locationNo === 'MAIN') ||
      locations.body[0];
    locationId = mainLoc.locationId;

    console.log('Setup: Getting GL accounts from API...');
    const bankAccountsRes = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    console.log('Setup: Got GL accounts');

    const bankLeaves: any[] = [];
    const bankWalk = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.isGroup) bankLeaves.push(node);
        if (node.children) bankWalk(node.children);
      }
    };
    bankWalk(bankAccountsRes.body);

    const bankAccount =
      bankLeaves.find((a) => a.accountCode === '1021') ||
      bankLeaves.find((a) => a.accountType === 'Bank') ||
      bankLeaves[0];
    bankAccountId = bankAccount.glAccountId;

    console.log('Setup: Getting GL Settings...');
    // Fetch GL Settings to get default accounts
    const settingsRes = await request(app.getHttpServer())
      .get('/api/gl/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect((res) => {
        if (res.status !== 200)
          console.error('Settings Fetch Error:', res.body);
      })
      .expect(200);
    const settings = settingsRes.body;
    baseCurrency = settings.baseCurrency || 'AUD';
    console.log('Setup: Got GL Settings, baseCurrency:', baseCurrency);

    const db = app.get(DRIZZLE);
    await db.execute(
      sql`UPDATE herobm_core.customers SET currency_code = ${baseCurrency} WHERE customer_id = ${customerId}`,
    );
    await db.execute(
      sql`UPDATE herobm_core.suppliers SET currency_code = ${baseCurrency} WHERE vendor_id = ${vendorId}`,
    );

    accounts = {
      ap: settings.defaultApAccountId,
      ar: settings.defaultArAccountId,
      inventory: settings.defaultInventoryAccountId,
      grni: settings.defaultGrniAccountId,
      ppv: settings.defaultPpvAccountId,
      cogs: settings.defaultCogsAccountId,
    };

    console.log('Setup: Verifying accounts exist...');
    // Verify all required accounts exist
    const missing = Object.entries(accounts)
      .filter(([, id]) => !id)
      .map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(`Missing default GL account for: ${missing.join(', ')}`);
    }

    console.log('Setup: Creating Product...');

    // 3. Create a fresh product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `PPV-TEST-${Math.random().toString(36).substring(7)}`,
        name: 'PPV Test Product',
        baseUom: 'EA',
        productType: 'inventory',
        structureType: 'standard',
      });

    if (productRes.status !== 201) {
      console.error('Product Creation Failed:', productRes.body);
    }

    expect(productRes.status).toBe(201);
    productId = productRes.body.productId;
    productNumber = productRes.body.productNumber;

    console.log('Setup: Product created with ID:', productId);

    console.log('Setup: Linking supplier to product...');
    const linkRes = await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        costPrice: '10.00',
      });

    console.log('Setup: Link supplier response status:', linkRes.status);
    expect(linkRes.status).toBe(201);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  let poId: string;
  let poLineId: string;
  let receiptId: string;
  let invoiceId: string;
  let soId: string;
  let soLineId: string;
  let binId: string;

  it('Step 1: Purchase Order Creation', async () => {
    poId = crypto.randomUUID();
    console.log(
      'Step 1: Starting PO creation with vendorId:',
      vendorId,
      'productId:',
      productId,
      'poId:',
      poId,
    );
    const poRes = await request(app.getHttpServer())
      .post('/api/purchase-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        purchaseOrderId: poId,
        orderNumber: `PO-LIFE-${Date.now()}`,
        vendorId,
        deliveryLocationId: locationId,
        currencyCode: baseCurrency,
        lines: [
          {
            productId,
            quantity: '10',
            pricePerUnit: '10.00',
            unitOfMeasure: 'EA',
          },
        ],
      });
    if (poRes.status !== 201) console.error('PO Creation Error:', poRes.body);
    expect(poRes.status).toBe(201);
    poId = poRes.body.purchaseOrderId;

    await request(app.getHttpServer())
      .patch(`/api/purchase-orders/${poId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'ordered' })
      .expect(200);

    const poDetail = await request(app.getHttpServer())
      .get(`/api/purchase-orders/${poId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    poLineId = poDetail.body.lines[0].purchaseOrderLineId;
  });

  it('Step 2: Goods Receipt & Accrual (GRNI)', async () => {
    const grnRes = await request(app.getHttpServer())
      .post('/api/goods-received')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        locationId,
        packingSlipNumber: 'LIFE-PACK-1',
        lines: [{ productId, quantityReceived: '10' }],
      });

    if (grnRes.status !== 201) console.error('Step 2 GRN error:', grnRes.body);
    expect(grnRes.status).toBe(201);
    receiptId = grnRes.body.goodsReceivedId;

    // Verify GL Journal
    const glRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries?sourceId=${receiptId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entrySummary = glRes.body.data?.[0];
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();
    const invLine = entry.lines.find(
      (l: any) => l.accountId === accounts.inventory,
    );
    expect(parseFloat(invLine.debit)).toBe(100);

    const grniLine = entry.lines.find(
      (l: any) => l.accountId === accounts.grni,
    );
    expect(parseFloat(grniLine.credit)).toBe(100);

    const invRes = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const level = invRes.body.find((l: any) => l.locationId === locationId) ||
      invRes.body[0] || { quantityOnHand: 0 };
    console.log('QOH after Step 2:', level?.quantityOnHand);
  });

  it('Step 3: Putaway (Receiving to Storage)', async () => {
    // Get pending putaways
    const pendingRes = await request(app.getHttpServer())
      .get(`/api/inventory/pending-putaway?locationId=${locationId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const putawayLine = pendingRes.body.find(
      (p: any) => p.productId === productId,
    );
    expect(putawayLine).toBeDefined();
    receiptLineId = putawayLine.id;

    // Get a valid STORAGE bin
    // Get a valid storage bin
    const db = app.get(DRIZZLE);
    const [storageBin] = await db
      .select({
        binId: bins.binId,
        binNumber: bins.binNumber,
        zoneCode: zones.code,
      })
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(and(eq(zones.locationId, locationId), eq(bins.binType, 'storage')))
      .limit(1);

    console.log('Found storage bin:', storageBin);

    binId = storageBin.binId as string;

    // Process Putaway
    await request(app.getHttpServer())
      .post('/api/inventory/putaway')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        putaways: [
          {
            lineId: putawayLine.id,
            sourceType: 'goods_receipt',
            destinationBinId: binId,
            quantity: '10',
          },
        ],
      })
      .expect(201);

    // Verify Available QOH is 10
    const invRes = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    console.log('invRes.body:', invRes.body);
    const level = invRes.body.find((l: any) => l.locationId === locationId) ||
      invRes.body[0] || { quantityOnHand: 0 };
    const binsLog = await request(app.getHttpServer())
      .get(`/api/inventory/bins`)
      .set('Authorization', `Bearer ${adminToken}`);
    console.log('Bins after putaway:', binsLog.body.data);
    expect(parseFloat(level.quantityOnHand)).toBe(10);
  });

  it('Step 4: Purchase Invoice with PPV', async () => {
    const invRes = await request(app.getHttpServer())
      .post('/api/purchase-invoices')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        purchaseOrderId: poId,
        supplierInvoiceNumber: `INV-LIFE-${Date.now()}`,
        currencyCode: baseCurrency,
        totalAmount: 120.0,
        taxAmount: 0,
        lines: [
          {
            productId,
            purchaseOrderLineId: poLineId,
            quantityInvoiced: 10,
            pricePerUnit: 12.0, // Variance: $2 per unit
          },
        ],
      })
      .expect(201);
    invoiceId = invRes.body.invoiceId;

    // Manually link the invoice line to the receipt line for PPV matching
    const db = app.get(DRIZZLE);
    const [invLine] = await db
      .select({ invoiceLineId: purchaseInvoiceLines.invoiceLineId })
      .from(purchaseInvoiceLines)
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId))
      .limit(1);

    await db.insert(purchaseInvoiceReceipts).values({
      invoiceLineId: invLine.invoiceLineId,
      goodsReceivedLineId: receiptLineId,
      quantityBilled: '10',
    });

    await request(app.getHttpServer())
      .post(`/api/purchase-invoices/${invoiceId}/post`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    // Verify GL Journal
    const glRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries?sourceId=${invoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entrySummary = glRes.body.data[0];
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();

    console.log('Journal Entry Lines:', JSON.stringify(entry.lines, null, 2));
    console.log('Looking for accounts:', accounts);

    const apLine = entry.lines.find((l: any) => l.accountId === accounts.ap);
    if (!apLine) throw new Error('AP line not found');
    expect(parseFloat(apLine.credit)).toBe(120);

    const grniLine = entry.lines.find(
      (l: any) => l.accountId === accounts.grni,
    );
    if (!grniLine) throw new Error('GRNI line not found');
    expect(parseFloat(grniLine.debit)).toBe(100);

    const ppvLine = entry.lines.find((l: any) => l.accountId === accounts.ppv);
    if (!ppvLine) throw new Error('PPV line not found');
    expect(parseFloat(ppvLine.debit)).toBe(20);
  });

  it('Step 5: Supplier Payment', async () => {
    const payRes = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        partyId: vendorId,
        paymentId: crypto.randomUUID(),
        paymentType: 'supplier_payment',
        paymentDate: new Date().toISOString(),
        modeOfPayment: 'EFT',
        totalAmount: 120.0,
        glAccountBank: bankAccountId,
        currencyCode: baseCurrency,
        submitImmediately: true,
        allocations: [
          {
            referenceType: 'purchase_invoice',
            referenceId: invoiceId,
            allocatedAmount: 120.0,
          },
        ],
      });

    if (payRes.status !== 201)
      throw new Error('Step 5 Payment error: ' + JSON.stringify(payRes.body));
    expect(payRes.status).toBe(201);

    const paymentId = payRes.body.paymentId;

    // Verify GL
    const glRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries?sourceId=${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entrySummary = glRes.body.data[0];
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();

    const apLine = entry.lines.find((l: any) => l.accountId === accounts.ap);
    expect(parseFloat(apLine.debit)).toBe(120);
  });

  it('Step 6: Sales Order Creation', async () => {
    const soRes = await request(app.getHttpServer())
      .post('/api/sales-orders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        salesOrderId: crypto.randomUUID(),
        fulfillmentLocationId: '10000000-0000-4000-8000-000000000001',
        customerId,
        deliveryAddressLine1: '123 E2E St',
        deliveryCity: 'E2E City',
        deliveryCountry: 'US',
        name: 'SO E2E Lifecycle',
        lines: [{ productId, quantity: '5', pricePerUnit: '25.00' }],
      });

    if (soRes.status !== 201)
      throw new Error('Step 6 SO error: ' + JSON.stringify(soRes.body));
    expect(soRes.status).toBe(201);
    soId = soRes.body.salesOrderId;

    const quotedRes = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'quoted' });
    if (quotedRes.status !== 200) console.log('Quoted error:', quotedRes.body);
    expect(quotedRes.status).toBe(200);

    const confRes = await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'confirmed', generateBackorders: false });
    if (confRes.status !== 200) console.log('Confirmed error:', confRes.body);
    expect(confRes.status).toBe(200);

    await request(app.getHttpServer())
      .patch(`/api/sales-orders/${soId}/state`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stateCode: 'picking' })
      .expect(200);

    const soDetail = await request(app.getHttpServer())
      .get(`/api/sales-orders/${soId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    soLineId = soDetail.body.lines[0].salesOrderLineId;
  });

  it('Step 7: Sales Shipment (Picking/COGS)', async () => {
    await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/picking/lines/${soLineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ binId, quantity: '5' })
      .expect(201);

    const shipRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/shipments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        lines: [{ salesOrderLineId: soLineId, quantityShipped: '5' }],
      })
      .expect(201);

    // Verify QOH reduced to 5
    const invRes = await request(app.getHttpServer())
      .get(`/api/inventory/by-products?productIds=${productId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const level = invRes.body.find((l: any) => l.locationId === locationId) ||
      invRes.body[0] || { quantityOnHand: 0 };
    expect(parseFloat(level.quantityOnHand)).toBe(5);

    // Verify GL (COGS Debit 50, Inventory Credit 50)
    // Shipment GL entries use shipmentId
    const glRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries?sourceId=${shipRes.body.shipmentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entrySummary = glRes.body.data[0];
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    const cogsLine = entry.lines.find(
      (l: any) => l.accountId === accounts.cogs,
    );
    console.log('Shipment Journal Entry:', JSON.stringify(entry, null, 2));
    expect(parseFloat(cogsLine.debit)).toBe(50);

    const inventoryLine = entry.lines.find(
      (l: any) => l.accountId === accounts.inventory,
    );
    expect(parseFloat(inventoryLine.credit)).toBe(50);
  });

  it('Step 8: Sales Invoice (AR/Revenue)', async () => {
    const invRes = await request(app.getHttpServer())
      .post(`/api/sales-orders/${soId}/invoice`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notes: 'E2E Lifecycle Sales Invoice' })
      .expect(201);

    salesInvoiceId = invRes.body.invoiceId;

    const glRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries?sourceId=${salesInvoiceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entrySummary = glRes.body.data[0];
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();
    console.log('Invoice Journal Entry:', JSON.stringify(entry, null, 2));
    const arLine = entry.lines.find((l: any) => l.accountId === accounts.ar);
    expect(parseFloat(arLine.debit)).toBe(137.5); // 5 * $25 + 10% tax
  });

  it('Step 9: Customer Payment', async () => {
    const payRes = await request(app.getHttpServer())
      .post('/api/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        partyId: customerId,
        paymentId: crypto.randomUUID(),
        paymentType: 'customer_receipt',
        paymentDate: new Date().toISOString(),
        modeOfPayment: 'EFT',
        totalAmount: 137.5,
        glAccountBank: bankAccountId,
        currencyCode: baseCurrency,
        submitImmediately: true,
        allocations: [
          {
            referenceType: 'sales_invoice',
            referenceId: salesInvoiceId,
            allocatedAmount: 137.5,
          },
        ],
      })
      .expect(201);

    const paymentId = payRes.body.paymentId;

    const glRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries?sourceId=${paymentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entrySummary = glRes.body.data[0];
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();

    const arLine = entry.lines.find((l: any) => l.accountId === accounts.ar);
    if (!arLine) {
      console.log(
        'Step 9 Journal Lines:',
        JSON.stringify(entry.lines, null, 2),
      );
      console.log('Looking for AR account:', accounts.ar);
    }
    expect(parseFloat(arLine.credit)).toBe(137.5);
  });
});
