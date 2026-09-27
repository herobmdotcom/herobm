import { TestingModule } from '@nestjs/testing';
import { createE2eModule, setupE2eApp } from './utils/e2e-module';
import { INestApplication, ValidationPipe } from '@nestjs/common';
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
} from '@herobm/db-schema';
import { CUSTOMER_STATE } from '@herobm/shared';
import { DRIZZLE } from '../src/drizzle/drizzle.module';
import { AppConfigService } from '../src/settings/app-config.service';

describe('Inventory & GL Lifecycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;

  async function pollForGlEntry(sourceId: string, retries = 5, delay = 50) {
    for (let i = 0; i < retries; i++) {
      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceId=${sourceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      const entry = glRes.body.data?.[0];
      if (entry) return entry;
      await new Promise((r) => setTimeout(r, delay));
    }

    // Diagnostic
    const appConfig = app.get(AppConfigService);
    console.error('POLL FAILED FOR:', sourceId);
    console.error(
      'appConfig.inventoryAccountingMode:',
      appConfig.inventoryAccountingMode(),
    );
    console.error(
      'appConfig.defaultCogsAccountId:',
      appConfig.defaultCogsAccountId(),
    );
    const db = app.get(DRIZZLE);
    const dbGl = await db.execute(
      sql`SELECT * FROM herobm_core.gl_settings LIMIT 1`,
    );
    console.error('DB gl_settings:', dbGl);
    const rawJe = await db.execute(
      sql`SELECT * FROM herobm_core.gl_journal_entries WHERE source_id = ${sourceId}::uuid`,
    );
    console.error('Raw DB entries for sourceId:', rawJe);

    throw new Error(`Failed to find GL entry for sourceId ${sourceId}`);
  }

  let vendorId: string;
  let customerId: string;
  let productId: string;
  let productNumber: string;
  let locationId: string;
  let baseCurrency: string;
  let bankAccountId: string;
  let taxCategoryId: string;

  // GL Accounts needed for verification
  let accounts: Record<string, string> = {};

  // Cross-step data
  let salesInvoiceId: string;
  let receiptLineId: string;

  beforeAll(async () => {
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
      .get('/api/customers?limit=10')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const activeCustomer =
      customers.body.data.find(
        (c: any) => c.stateCode === CUSTOMER_STATE.ACTIVE,
      ) || customers.body.data[0];
    customerId = activeCustomer.customerId;

    const vendors = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = vendors.body.data[0].vendorId;

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const mainLoc =
      locations.body.find((l: any) => l.code === 'MAIN') || locations.body[0];
    locationId = mainLoc.locationId;

    const bankAccountsRes = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const allLeaves: any[] = [];
    const bankWalk = (nodes: any[]) => {
      for (const node of nodes) {
        if (!node.isGroup) allLeaves.push(node);
        if (node.children) bankWalk(node.children);
      }
    };
    bankWalk(bankAccountsRes.body);

    const findAccount = (code: string, fallbackType?: string) => {
      const found =
        allLeaves.find((a) => a.accountCode === code) ||
        (fallbackType
          ? allLeaves.find((a) => a.accountType === fallbackType)
          : null);
      if (!found) {
        throw new Error(
          `Could not find GL account with code ${code} or type ${fallbackType}`,
        );
      }
      return found.glAccountId;
    };

    const bankAccount =
      allLeaves.find((a) => a.accountCode === '1021') ||
      allLeaves.find((a) => a.accountType === 'Bank') ||
      allLeaves[0];
    bankAccountId = bankAccount.glAccountId;

    const apId = findAccount('2100', 'Payable');
    const arId = findAccount('1100', 'Receivable');
    const invId = findAccount('1300', 'Stock');
    const grniId = findAccount('2150', 'Liability');
    const ppvId = findAccount('5400', 'Cost of Goods Sold');
    const cogsId = findAccount('5100', 'Cost of Goods Sold');

    accounts = {
      ap: apId,
      ar: arId,
      inventory: invId,
      grni: grniId,
      ppv: ppvId,
      cogs: cogsId,
    };

    const taxCatRes = await request(app.getHttpServer())
      .get('/api/tax-categories')
      .set('Authorization', `Bearer ${adminToken}`);
    const gstCat =
      (taxCatRes.body || []).find((c: any) => parseFloat(c.rate) === 0.1) ||
      taxCatRes.body[0];
    taxCategoryId = gstCat?.taxCategoryId;

    // Fetch GL Settings to get default base currency
    const settingsRes = await request(app.getHttpServer())
      .get('/api/gl/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const settings = settingsRes.body;
    baseCurrency = settings.baseCurrency || 'AUD';

    const db = app.get(DRIZZLE);
    await db.execute(
      sql`UPDATE herobm_core.gl_settings SET 
        default_ap_account_id = ${apId}::uuid,
        default_ar_account_id = ${arId}::uuid,
        default_inventory_account_id = ${invId}::uuid,
        default_grni_account_id = ${grniId}::uuid,
        default_ppv_account_id = ${ppvId}::uuid,
        default_cogs_account_id = ${cogsId}::uuid`,
    );
    await db.execute(
      sql`UPDATE herobm_core.app_settings SET 
        inventory_accounting_mode = 'perpetual',
        inventory_valuation_method = 'weighted_average'`,
    );
    await db.execute(
      sql`UPDATE herobm_core.customers SET currency_code = ${baseCurrency} WHERE customer_id = ${customerId}`,
    );
    await db.execute(
      sql`UPDATE herobm_core.suppliers SET currency_code = ${baseCurrency} WHERE vendor_id = ${vendorId}`,
    );

    const appConfig = app.get(AppConfigService);
    await appConfig.reload();

    // Verify all required accounts exist
    const missing = Object.entries(accounts)
      .filter(([, id]) => !id)
      .map(([key]) => key);
    if (missing.length > 0) {
      throw new Error(`Missing default GL account for: ${missing.join(', ')}`);
    }

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

    const linkRes = await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        costPrice: '10.00',
      });

    expect(linkRes.status).toBe(201);
  }, 120_000);

  afterAll(async () => {
    try {
      const db = app.get(DRIZZLE);
      await db.execute(
        sql`UPDATE herobm_core.app_settings SET inventory_accounting_mode = 'periodic'`,
      );
      const appConfig = app.get(AppConfigService);
      await appConfig.reload();
    } catch {
      // ignore
    }
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
        purchaseOrderId: poId,
        vendorId,
        locationId,
        packingSlipNumber: 'LIFE-PACK-1',
        lines: [
          { purchaseOrderLineId: poLineId, productId, quantityReceived: '10' },
        ],
      });

    if (grnRes.status !== 201) console.error('Step 2 GRN error:', grnRes.body);
    expect(grnRes.status).toBe(201);
    receiptId = grnRes.body.goodsReceivedId;

    // Verify GL Journal
    const entrySummary = await pollForGlEntry(receiptId);
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

    let testBinId = storageBin?.binId as string | undefined;
    if (!testBinId) {
      const zoneId = crypto.randomUUID();
      await db.insert(zones).values({
        zoneId,
        locationId,
        code: 'Z-E2E',
        name: 'E2E Zone',
        source: 'e2e',
      });
      testBinId = crypto.randomUUID();
      await db.insert(bins).values({
        binId: testBinId,
        zoneId,
        binNumber: 'B-E2E',
        binType: 'storage',
        source: 'e2e',
      });
    }
    binId = testBinId;

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

    const level = invRes.body.find((l: any) => l.locationId === locationId) ||
      invRes.body[0] || { quantityOnHand: 0 };
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
    const entrySummary = await pollForGlEntry(invoiceId);
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();

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
    const entrySummary = await pollForGlEntry(paymentId);
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
        fulfillmentLocationId: locationId,
        customerId,
        deliveryAddressLine1: '123 E2E St',
        deliveryCity: 'E2E City',
        deliveryCountry: 'US',
        name: 'SO E2E Lifecycle',
        lines: [
          { productId, quantity: '5', pricePerUnit: '25.00', taxCategoryId },
        ],
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
    const entrySummary = await pollForGlEntry(shipRes.body.shipmentId);

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    const cogsLine = entry.lines.find(
      (l: any) => l.accountId === accounts.cogs,
    );
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

    const entrySummary = await pollForGlEntry(salesInvoiceId);
    expect(entrySummary).toBeDefined();

    const glDetailRes = await request(app.getHttpServer())
      .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const entry = glDetailRes.body;
    expect(entry.lines).toBeDefined();
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

    const entrySummary = await pollForGlEntry(paymentId);
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
