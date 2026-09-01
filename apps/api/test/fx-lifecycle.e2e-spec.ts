import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { eq, sql, and } from 'drizzle-orm';
import {
  glAccounts,
  bins,
  zones,
  purchaseInvoiceReceipts,
  purchaseInvoiceLines,
  glSettings,
} from '@herobm/db-schema';
import { DRIZZLE } from '../src/drizzle/drizzle.module';

describe('FX Lifecycle (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let vendorId: string;
  let customerId: string;
  let productId: string;
  let productNumber: string;
  let locationId: string;
  let bankAccountId: string;

  // GL Accounts needed for verification
  let accounts: Record<string, string> = {};

  // Cross-step data
  let poId: string;
  let poLineId: string;
  let receiptId: string;
  let receiptLineId: string;
  let invoiceId: string;
  let soId: string;
  let soLineId: string;
  let salesInvoiceId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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

    await request(app.getHttpServer())
      .patch(`/api/customers/${customerId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currencyCode: 'GBP' })
      .expect(200);

    const vendors = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = vendors.body.data[0].vendorId;

    await request(app.getHttpServer())
      .patch(`/api/suppliers/${vendorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ currencyCode: 'EUR' })
      .expect(200);

    const locations = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    locationId = locations.body[0].locationId;

    const bankAccountsRes = await request(app.getHttpServer())
      .get('/api/gl/accounts')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

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

    // Ensure we have an FX Gain and Loss account in GL Settings!
    const db = app.get(DRIZZLE);
    const [settings] = await db.select().from(glSettings).limit(1);

    let fxGainId = settings.realisedFxGainAccountId;
    let fxLossId = settings.realisedFxLossAccountId;
    let ppvId = settings.defaultPpvAccountId;

    // Find or create accounts
    const allAccounts = await db.select().from(glAccounts);

    if (!fxGainId || !fxLossId) {
      fxGainId = allAccounts.find(
        (a: any) =>
          a.accountType === 'revenue' && a.currencyCode === 'AUD' && !a.isGroup,
      )?.glAccountId;
      fxLossId = allAccounts.find(
        (a: any) =>
          a.accountType === 'expense' && a.currencyCode === 'AUD' && !a.isGroup,
      )?.glAccountId;

      // Update settings
      await db.update(glSettings).set({
        realisedFxGainAccountId: fxGainId,
        realisedFxLossAccountId: fxLossId,
      });
    }

    // Ensure PPV account is not a group account!
    const currentPpvAccount = allAccounts.find(
      (a: any) => a.glAccountId === ppvId,
    );
    if (!currentPpvAccount || currentPpvAccount.isGroup) {
      ppvId = allAccounts.find(
        (a: any) =>
          a.accountType === 'expense' && a.currencyCode === 'AUD' && !a.isGroup,
      )?.glAccountId;
      await db.update(glSettings).set({ defaultPpvAccountId: ppvId });
    }

    const settingsRes = await request(app.getHttpServer())
      .get('/api/gl/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const settingsApi = settingsRes.body;

    accounts = {
      ap: settingsApi.defaultApAccountId,
      ar: settingsApi.defaultArAccountId,
      inventory: settingsApi.defaultInventoryAccountId,
      grni: settingsApi.defaultGrniAccountId,
      ppv: settingsApi.defaultPpvAccountId,
      cogs: settingsApi.defaultCogsAccountId,
      fxGain: settingsApi.realisedFxGainAccountId,
      fxLoss: settingsApi.realisedFxLossAccountId,
    };

    // 3. Create a fresh product
    const productRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: 'FX-LIFECYCLE-01',
        name: 'FX Test Product',
        baseUom: 'EA',
        productType: 'inventory',
        structureType: 'standard',
      })
      .expect(201);

    productId = productRes.body.productId;
    productNumber = productRes.body.productNumber;

    await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        isPreferred: true,
        costPrice: '100.00',
        currencyCode: 'EUR',
        minOrderQty: 1,
      })
      .expect(201);
  }, 120_000);

  afterAll(async () => {
    await app.close();
  });

  // HELPER to insert exchange rates
  const setExchangeRate = async (
    currency: string,
    date: string,
    rate: string,
  ) => {
    await request(app.getHttpServer())
      .post('/api/settings/exchange-rates')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        currencyCode: currency,
        currencyName: currency,
        effectiveDate: date,
        buyRate: rate,
        sellRate: rate,
      })
      .expect(201);
  };

  const setDirectExchangeRate = async (
    currency: string,
    date: string,
    directRate: number,
  ) => {
    // directRate is the exact multiplier to convert the foreign currency to base currency
    const exactRate = directRate.toFixed(6);
    await setExchangeRate(currency, date, exactRate);
  };

  beforeAll(async () => {
    // Ensure base currency AUD has a rate of 1.0 so triangulation works
    await setExchangeRate('AUD', '1999-01-01', '1.0');
  });

  describe('Full P2P (Procure-to-Pay) Lifecycle', () => {
    it('Setup: Exchange rate EUR = 1.10 on Day 1', async () => {
      await setDirectExchangeRate('EUR', '2026-06-01', 1.1);
    });

    it('Step 1: Purchase Order Creation (10 units @ 100 EUR, Rate 1.10)', async () => {
      poId = crypto.randomUUID();
      const poRes = await request(app.getHttpServer())
        .post('/api/purchase-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          purchaseOrderId: poId,
          orderNumber: `PO-FX-${Date.now()}`,
          vendorId,
          deliveryLocationId: locationId,
          currencyCode: 'EUR',
          orderDate: '2026-06-01',
          lines: [
            {
              productId,
              quantity: '10',
              pricePerUnit: '100.00', // 100 EUR
              unitOfMeasure: 'EA',
            },
          ],
        })
        .then((res) => {
          if (res.status !== 201)
            throw new Error('PO Creation Error: ' + JSON.stringify(res.body));
          return res;
        });
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
      expect(parseFloat(poDetail.body.exchangeRate)).toBeCloseTo(1.1, 5);
    });

    it('Setup: Exchange rate EUR = 1.15 on Day 2', async () => {
      await setDirectExchangeRate('EUR', '2026-06-02', 1.15);
    });

    it('Step 2: Goods Receipt & Accrual (GRNI)', async () => {
      // NOTE: Inventory valuation uses PO Rate for GRNI to avoid variance during receipt!
      const grnRes = await request(app.getHttpServer())
        .post('/api/goods-received')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId,
          locationId,
          packingSlipNumber: 'FX-PACK-1',
          dateReceived: '2026-06-02', // Day 2
          lines: [
            {
              productId,
              quantityReceived: '10',
              purchaseOrderLineId: poLineId,
            },
          ],
        })
        .expect(201);
      receiptId = grnRes.body.goodsReceivedId;

      // Verify GL Journal
      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceId=${receiptId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entrySummary = glRes.body.data?.[0];
      const glDetailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = glDetailRes.body;
      const invLine = entry.lines.find(
        (l: any) => l.accountId === accounts.inventory,
      );
      const grniLine = entry.lines.find(
        (l: any) => l.accountId === accounts.grni,
      );

      // Expected: 10 * 100 EUR = 1000 EUR. PO Rate = 1.10. Base = 1100 AUD
      expect(parseFloat(invLine.debit)).toBeCloseTo(1100, 5);
      expect(parseFloat(grniLine.credit)).toBeCloseTo(1100, 5);

      // Get pending putaway to link to invoice
      const pendingRes = await request(app.getHttpServer())
        .get(`/api/inventory/pending-putaway?locationId=${locationId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const putawayLine = pendingRes.body.find(
        (p: any) => p.productId === productId,
      );
      receiptLineId = putawayLine.id;
    });

    it('Setup: Exchange rate EUR = 1.20 on Day 3', async () => {
      await setDirectExchangeRate('EUR', '2026-06-03', 1.2);
    });

    it('Step 3: Purchase Invoice (105 EUR, Rate 1.20) with FX & PPV', async () => {
      const invRes = await request(app.getHttpServer())
        .post('/api/purchase-invoices')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          vendorId,
          purchaseOrderId: poId,
          supplierInvoiceNumber: `INV-FX-${Date.now()}`,
          currencyCode: 'EUR',
          invoiceDate: '2026-06-03', // Day 3
          totalAmount: 1050.0,
          taxAmount: 0,
          lines: [
            {
              productId,
              purchaseOrderLineId: poLineId,
              quantityInvoiced: 10,
              pricePerUnit: 105.0, // Variance: 5 EUR per unit
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
        .then((res) => {
          if (res.status !== 200)
            throw new Error('PI Post Error: ' + JSON.stringify(res.body));
          return res;
        });

      // Verify GL Journal
      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceId=${invoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entrySummary = glRes.body.data[0];
      const glDetailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = glDetailRes.body;
      const apLine = entry.lines.find((l: any) => l.accountId === accounts.ap);
      const grniLine = entry.lines.find(
        (l: any) => l.accountId === accounts.grni,
      );
      const ppvLine = entry.lines.find(
        (l: any) => l.accountId === accounts.ppv,
      );
      const fxLine = entry.lines.find(
        (l: any) => l.accountId === accounts.fxLoss,
      );

      // Invoice Total = 1050 EUR @ 1.20 = 1260 AUD
      expect(parseFloat(apLine.credit)).toBeCloseTo(1260, 5);

      // GRNI Clearance = 10 * 100 EUR @ 1.10 = 1100 AUD
      expect(parseFloat(grniLine.debit)).toBeCloseTo(1100, 5);

      // PPV = (105 - 100) EUR * 10 = 50 EUR @ 1.20 = 60 AUD
      expect(parseFloat(ppvLine.debit)).toBeCloseTo(60, 5);

      // FX Variance = 1000 EUR @ (1.20 - 1.10) = 100 AUD
      expect(parseFloat(fxLine.debit)).toBeCloseTo(100, 5);
    });

    it('Setup: Exchange rate EUR = 1.18 on Day 4', async () => {
      await setDirectExchangeRate('EUR', '2026-06-04', 1.18);
    });

    it('Step 4: Supplier Payment (Realized FX Gain)', async () => {
      const payRes = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          partyId: vendorId,
          paymentType: 'supplier_payment',
          paymentDate: '2026-06-04',
          modeOfPayment: 'EFT',
          totalAmount: 1050.0,
          currencyCode: 'EUR',
          glAccountBank: bankAccountId,
          submitImmediately: true,
          allocations: [
            {
              referenceType: 'purchase_invoice',
              referenceId: invoiceId,
              allocatedAmount: 1050.0,
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
      const glDetailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = glDetailRes.body;
      const apLine = entry.lines.find((l: any) => l.accountId === accounts.ap);
      const fxGainLine = entry.lines.find(
        (l: any) => l.accountId === accounts.fxGain,
      );
      const lines = entry.lines;
      const bankLine = entry.lines.find(
        (l: any) => l.accountId === bankAccountId,
      );

      // AP Cleared = 1260 AUD
      expect(parseFloat(apLine.debit)).toBeCloseTo(1260, 5);

      // Bank payment = 1050 EUR @ 1.18 = 1239 AUD
      expect(parseFloat(bankLine.credit)).toBeCloseTo(1239, 5);

      // 1260 - 1239 = 21 Realized FX Gain
      expect(fxGainLine).toBeDefined();
      expect(parseFloat(fxGainLine.credit)).toBeCloseTo(21, 5);
    });
  });

  describe('Full O2C (Order-to-Cash) Lifecycle', () => {
    it('Setup: Exchange rate GBP = 1.30 on Day 1', async () => {
      await setDirectExchangeRate('GBP', '2026-06-01', 1.3);
    });

    it('Step 1: Sales Order Creation (5 units @ 200 GBP)', async () => {
      const soRes = await request(app.getHttpServer())
        .post('/api/sales-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          fulfillmentLocationId: locationId,
          customerId,
          deliveryAddressLine1: '123 FX St',
          deliveryCity: 'FX City',
          deliveryCountryCode: 'GB',
          currencyCode: 'GBP',
          orderDate: '2026-06-01',
          name: 'SO FX Lifecycle',
          lines: [{ productId, quantity: '5', pricePerUnit: '200.00' }], // 1000 GBP Subtotal + 100 GST = 1100 GBP Total
        })
        .expect(201);
      soId = soRes.body.salesOrderId;

      const soDetail = await request(app.getHttpServer())
        .get(`/api/sales-orders/${soId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      soLineId = soDetail.body.lines[0].salesOrderLineId;

      expect(parseFloat(soDetail.body.exchangeRate)).toBeCloseTo(1.3, 5);
    });

    it('Setup: Exchange rate GBP = 1.40 on Day 3', async () => {
      await setDirectExchangeRate('GBP', '2026-06-03', 1.4);
    });

    it('Step 2: Sales Invoice (AR/Revenue)', async () => {
      const db = app.get(DRIZZLE);
      await db.execute(
        sql`UPDATE herobm_core.sales_orders SET state_code = 'shipped' WHERE sales_order_id = ${soId}`,
      );

      const shipmentId = '00000000-0000-4000-8000-000000000001';
      await db.execute(
        sql`INSERT INTO herobm_core.sales_order_shipments (shipment_id, shipment_number, sales_order_id, state_code) VALUES (${shipmentId}, 'SHIP-FX-TEST', ${soId}, 'dispatched') ON CONFLICT DO NOTHING`,
      );
      await db.execute(
        sql`INSERT INTO herobm_core.sales_order_shipment_lines (shipment_line_id, shipment_id, sales_order_line_id, quantity_shipped) VALUES (gen_random_uuid(), ${shipmentId}, ${soLineId}, 5) ON CONFLICT DO NOTHING`,
      );

      const invRes = await request(app.getHttpServer())
        .post(`/api/sales-orders/${soId}/invoice`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          notes: 'FX O2C Sales Invoice',
          invoiceDate: '2026-06-03',
        })
        .then((res) => {
          if (res.status !== 201)
            throw new Error('SI Create Error: ' + JSON.stringify(res.body));
          return res;
        });

      salesInvoiceId = invRes.body.invoiceId;

      const glRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries?sourceId=${salesInvoiceId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entrySummary = glRes.body.data[0];
      const glDetailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = glDetailRes.body;
      const arLine = entry.lines.find((l: any) => l.accountId === accounts.ar);

      // 1100 GBP @ 1.40 = 1540 AUD
      expect(parseFloat(arLine.debit)).toBeCloseTo(1540, 5);
    });

    it('Setup: Exchange rate GBP = 1.38 on Day 4', async () => {
      await setDirectExchangeRate('GBP', '2026-06-04', 1.38);
    });

    it('Step 3: Customer Payment (Realized FX Loss)', async () => {
      const payRes = await request(app.getHttpServer())
        .post('/api/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          partyId: customerId,
          paymentType: 'customer_receipt',
          paymentDate: '2026-06-04',
          modeOfPayment: 'EFT',
          totalAmount: 1100.0,
          currencyCode: 'GBP',
          glAccountBank: bankAccountId,
          submitImmediately: true,
          allocations: [
            {
              referenceType: 'sales_invoice',
              referenceId: salesInvoiceId,
              allocatedAmount: 1100.0,
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
      const glDetailRes = await request(app.getHttpServer())
        .get(`/api/gl/journal-entries/${entrySummary.journalEntryId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const entry = glDetailRes.body;
      const arLine = entry.lines.find((l: any) => l.accountId === accounts.ar);
      const fxLossLine = entry.lines.find(
        (l: any) => l.accountId === accounts.fxLoss,
      );
      const lines = entry.lines;
      const bankLine = entry.lines.find(
        (l: any) => l.accountId === bankAccountId,
      );

      // AR Cleared = 1540 AUD
      expect(parseFloat(arLine.credit)).toBeCloseTo(1540, 5);

      // Bank receipt = 1100 GBP @ 1.38 = 1518 AUD
      expect(parseFloat(bankLine.debit)).toBeCloseTo(1518, 5);

      // 1540 - 1518 = 22 Realized FX Loss
      expect(fxLossLine).toBeDefined();
      expect(parseFloat(fxLossLine.debit)).toBeCloseTo(22, 5);
    });
  });
});
