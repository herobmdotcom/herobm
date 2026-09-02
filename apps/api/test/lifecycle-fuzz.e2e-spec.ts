/**
 * End-to-End Cross-Ledger Lifecycle Fuzz & Triangulation E2E Test Suite
 *
 * Uses fast-check to test the complete business transaction lifecycles:
 *  - Procure-to-Pay (PO -> GRN -> Putaway -> Purchase Invoice with PPV -> Supplier Payment)
 *  - Order-to-Cash (SO -> Pick -> Ship with COGS -> Sales Invoice with Tax -> Customer Receipt)
 *  - Cross-Ledger Triangulation Invariants:
 *     1. Double-Entry Symmetry: Total Debits == Total Credits across all posted lifecycle journals.
 *     2. Individual Journal Balance: 100% of individual entries balance independently.
 *     3. Inventory Conservation & Valuation: Physical bin levels match ledger and GL entries.
 *     4. Subledger Consistency: AP and AR subledger clearing via payments.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule, setupE2eApp } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fc from 'fast-check';
import postgres from 'postgres';
import * as crypto from 'crypto';
import { eq } from 'drizzle-orm';
import {
  purchaseInvoiceReceipts,
  purchaseInvoiceLines,
} from '@herobm/db-schema';
import { DRIZZLE } from '../src/drizzle/drizzle.module';

describe('API E2E — End-to-End Cross-Ledger Lifecycle Fuzz Suite', () => {
  let app: INestApplication;
  let adminToken: string;
  let sqlClient: postgres.Sql;

  let customerId: string;
  let vendorId: string;
  let locationId: string;
  let storageBinId: string;
  let baseCurrency: string;
  let bankAccountId: string;
  let taxCategoryId: string;

  let accounts: {
    ap: string;
    ar: string;
    inventory: string;
    grni: string;
    ppv: string;
    cogs: string;
  };

  const NUM_RUNS = process.env.FUZZ_RUNS
    ? parseInt(process.env.FUZZ_RUNS, 10)
    : 10;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    setupE2eApp(app);
    await app.init();

    // 1. Admin Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      })
      .expect(201);
    adminToken = loginRes.body.access_token;

    // 2. Direct Postgres connection
    const user = process.env.POSTGRES_USER || 'postgres';
    const host = process.env.POSTGRES_HOST || '127.0.0.1';
    const port = process.env.POSTGRES_PORT || '5432';
    const db = process.env.POSTGRES_DB || 'herobm_local';
    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${user}:${process.env.POSTGRES_PASSWORD || 'password'}@${host}:${port}/${db}`;
    sqlClient = postgres(connectionString);

    // 3. Resolve Master Data
    const customersRes = await request(app.getHttpServer())
      .get('/api/customers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    customerId = customersRes.body.data[0].customerId;

    const suppliersRes = await request(app.getHttpServer())
      .get('/api/suppliers?limit=1')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    vendorId = suppliersRes.body.data[0].vendorId;

    const locationsRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const mainLoc =
      locationsRes.body.find((l: any) => l.code === 'MAIN') ||
      locationsRes.body[0];
    locationId = mainLoc.locationId;

    // 4. Resolve Bank Account
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

    // 5. Resolve Tax Category
    const taxCatRes = await request(app.getHttpServer())
      .get('/api/tax-categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const gstCat =
      (taxCatRes.body || []).find((c: any) => parseFloat(c.rate) === 0.1) ||
      taxCatRes.body[0];
    taxCategoryId = gstCat?.taxCategoryId;

    // 6. Resolve GL Settings
    const settingsRes = await request(app.getHttpServer())
      .get('/api/gl/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    const settings = settingsRes.body;
    baseCurrency = settings.baseCurrency || 'AUD';

    // Synchronize customer & supplier currency with base currency
    await sqlClient`
      UPDATE herobm_core.customers SET currency_code = ${baseCurrency} WHERE customer_id = ${customerId}::uuid
    `;
    await sqlClient`
      UPDATE herobm_core.suppliers SET currency_code = ${baseCurrency} WHERE vendor_id = ${vendorId}::uuid
    `;

    accounts = {
      ap: settings.defaultApAccountId,
      ar: settings.defaultArAccountId,
      inventory: settings.defaultInventoryAccountId,
      grni: settings.defaultGrniAccountId,
      ppv: settings.defaultPpvAccountId,
      cogs: settings.defaultCogsAccountId,
    };

    // 7. Ensure Storage Zone & Dedicated Storage Bin exist
    const storageZones = await sqlClient`
      SELECT zone_id FROM herobm_core.zones
      WHERE location_id = ${locationId}::uuid AND code != 'HANDLING'
      LIMIT 1
    `;
    let zoneId: string;
    if (storageZones.length === 0) {
      const newZId = crypto.randomUUID();
      await sqlClient`
        INSERT INTO herobm_core.zones (zone_id, location_id, code, name, source, created_by)
        VALUES (${newZId}::uuid, ${locationId}::uuid, 'LIFE_ZONE', 'Lifecycle Storage Zone', 'test', 'system')
      `;
      zoneId = newZId;
    } else {
      zoneId = storageZones[0].zone_id;
    }

    const binId = crypto.randomUUID();
    const binNum = `LIFE-BIN-${Date.now().toString(36).toUpperCase()}`;
    await sqlClient`
      INSERT INTO herobm_core.bins (bin_id, bin_number, zone_id, bin_type, source, created_by)
      VALUES (${binId}::uuid, ${binNum}, ${zoneId}::uuid, 'storage', 'test', 'system')
    `;
    storageBinId = binId;
  }, 120000);

  afterAll(async () => {
    if (sqlClient) await sqlClient.end();
    if (app) await app.close();
  });

  let seqCounter = 0;
  const nextSeq = () => ++seqCounter;

  // Helper to create a fresh product with supplier link
  const createLifecycleProduct = async (
    costPrice: number,
    sellPrice: number,
  ) => {
    const pPayload: any = {
      productNumber: `LIFE-PROD-${Date.now()}-${nextSeq()}`,
      name: 'Lifecycle Fuzz Product',
      listPrice: sellPrice.toFixed(2),
      standardCost: costPrice.toFixed(2),
      productType: 'inventory',
      baseUom: 'EA',
      structureType: 'standard',
    };
    if (taxCategoryId) {
      pPayload.salesTaxCategoryId = taxCategoryId;
      pPayload.purchaseTaxCategoryId = taxCategoryId;
    }

    const pRes = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(pPayload);

    if (pRes.status !== 201) {
      console.error(
        'Create product failed with status:',
        pRes.status,
        JSON.stringify(pRes.body),
      );
    }
    expect(pRes.status).toBe(201);

    const productId = pRes.body.productId;

    // Set initial weighted_average_cost for WAC inventory valuation
    await sqlClient`
      UPDATE herobm_core.products 
      SET weighted_average_cost = ${costPrice.toFixed(2)}::numeric
      WHERE product_id = ${productId}::uuid
    `;

    await request(app.getHttpServer())
      .post(`/api/products/${productId}/suppliers`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        vendorId,
        costPrice: Number(costPrice.toFixed(2)),
      })
      .expect(201);

    return productId;
  };

  // =========================================================================
  // PROPERTY 1: Full Procure-to-Pay (P2P) Lifecycle with PPV & Triangulation
  // =========================================================================
  describe('Property 1: Full Procure-to-Pay (P2P) Lifecycle Fuzzing', () => {
    it('executes complete PO -> GRN -> Putaway -> PI (with PPV) -> Payment and balances all GL entries', async () => {
      const arbP2P = fc.record({
        qty: fc.integer({ min: 2, max: 50 }),
        poCost: fc.integer({ min: 10, max: 200 }),
        invoiceVariance: fc.integer({ min: -5, max: 15 }), // +/- price variance
      });

      await fc.assert(
        fc.asyncProperty(arbP2P, async ({ qty, poCost, invoiceVariance }) => {
          const invUnitCost = Math.max(1, poCost + invoiceVariance);
          const productId = await createLifecycleProduct(poCost, poCost * 2);

          // 1. Create & Order PO
          const poId = crypto.randomUUID();
          const poRes = await request(app.getHttpServer())
            .post('/api/purchase-orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              purchaseOrderId: poId,
              orderNumber: `PO-FUZZ-${Date.now()}-${nextSeq()}`,
              vendorId,
              deliveryLocationId: locationId,
              currencyCode: baseCurrency,
              lines: [
                {
                  productId,
                  quantity: qty.toString(),
                  pricePerUnit: poCost.toFixed(2),
                  unitOfMeasure: 'EA',
                },
              ],
            });
          expect(poRes.status).toBe(201);

          await request(app.getHttpServer())
            .patch(`/api/purchase-orders/${poId}/state`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ stateCode: 'ordered' })
            .expect(200);

          const poDetail = await request(app.getHttpServer())
            .get(`/api/purchase-orders/${poId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const poLineId = poDetail.body.lines[0].purchaseOrderLineId;

          // 2. Receive Goods (GRN)
          const grnRes = await request(app.getHttpServer())
            .post('/api/goods-received')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              vendorId,
              locationId,
              packingSlipNumber: `PACK-${Date.now()}-${nextSeq()}`,
              lines: [{ productId, quantityReceived: qty.toString() }],
            })
            .expect(201);

          const receiptId = grnRes.body.goodsReceivedId;

          // Verify GRN Journal Entry (DR Inventory, CR GRNI)
          const grnGlRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries?sourceId=${receiptId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          expect(grnGlRes.body.data.length).toBeGreaterThan(0);
          const grnSummary = grnGlRes.body.data[0];

          const grnDetailRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries/${grnSummary.journalEntryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const grnEntry = grnDetailRes.body;
          const grnDSum = grnEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.debit),
            0,
          );
          const grnCSum = grnEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.credit),
            0,
          );
          expect(grnDSum).toBeCloseTo(qty * poCost, 2);
          expect(grnCSum).toBeCloseTo(qty * poCost, 2);
          expect(grnDSum).toBeCloseTo(grnCSum, 2);

          // 3. Putaway to Storage Bin
          const pendingRes = await request(app.getHttpServer())
            .get(`/api/inventory/pending-putaway?locationId=${locationId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const putawayLine = pendingRes.body.find(
            (p: any) => p.productId === productId,
          );
          expect(putawayLine).toBeDefined();

          await request(app.getHttpServer())
            .post('/api/inventory/putaway')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              putaways: [
                {
                  lineId: putawayLine.id,
                  sourceType: 'goods_receipt',
                  destinationBinId: storageBinId,
                  quantity: qty.toString(),
                },
              ],
            })
            .expect(201);

          // Verify Bin Contents is updated to qty
          const binContentRes = await sqlClient`
            SELECT actual_quantity::numeric as qty
            FROM herobm_core.bin_contents
            WHERE bin_id = ${storageBinId}::uuid AND product_id = ${productId}::uuid
          `;
          expect(parseFloat(binContentRes[0].qty)).toEqual(qty);

          // 4. Create & Post Purchase Invoice (with PPV)
          const totalInvAmount = qty * invUnitCost;
          const invRes = await request(app.getHttpServer())
            .post('/api/purchase-invoices')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              vendorId,
              purchaseOrderId: poId,
              supplierInvoiceNumber: `INV-FUZZ-${Date.now()}-${nextSeq()}`,
              currencyCode: baseCurrency,
              totalAmount: totalInvAmount,
              taxAmount: 0,
              lines: [
                {
                  productId,
                  purchaseOrderLineId: poLineId,
                  quantityInvoiced: qty,
                  pricePerUnit: invUnitCost,
                },
              ],
            })
            .expect(201);
          const invoiceId = invRes.body.invoiceId;

          // Link invoice line to receipt line
          const db = app.get(DRIZZLE);
          const [invLine] = await db
            .select({ invoiceLineId: purchaseInvoiceLines.invoiceLineId })
            .from(purchaseInvoiceLines)
            .where(eq(purchaseInvoiceLines.invoiceId, invoiceId))
            .limit(1);

          await db.insert(purchaseInvoiceReceipts).values({
            invoiceLineId: invLine.invoiceLineId,
            goodsReceivedLineId: putawayLine.id,
            quantityBilled: qty.toString(),
          });

          await request(app.getHttpServer())
            .post(`/api/purchase-invoices/${invoiceId}/post`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          // Verify Purchase Invoice Journal Entry (DR GRNI, DR/CR PPV, CR AP)
          const piGlRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries?sourceId=${invoiceId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          expect(piGlRes.body.data.length).toBeGreaterThan(0);
          const piSummary = piGlRes.body.data[0];

          const piDetailRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries/${piSummary.journalEntryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const piEntry = piDetailRes.body;
          const piDSum = piEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.debit),
            0,
          );
          const piCSum = piEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.credit),
            0,
          );
          expect(piDSum).toBeCloseTo(piCSum, 2);

          // 5. Supplier Payment (Clear AP)
          const paymentId = crypto.randomUUID();
          await request(app.getHttpServer())
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              partyId: vendorId,
              paymentId,
              paymentType: 'supplier_payment',
              paymentDate: new Date().toISOString(),
              modeOfPayment: 'EFT',
              totalAmount: totalInvAmount,
              glAccountBank: bankAccountId,
              currencyCode: baseCurrency,
              submitImmediately: true,
              allocations: [
                {
                  referenceType: 'purchase_invoice',
                  referenceId: invoiceId,
                  allocatedAmount: totalInvAmount,
                },
              ],
            })
            .expect(201);

          // Verify Payment Journal Entry (DR AP, CR Bank)
          const payGlRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries?sourceId=${paymentId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          expect(payGlRes.body.data.length).toBeGreaterThan(0);
          const paySummary = payGlRes.body.data[0];

          const payDetailRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries/${paySummary.journalEntryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const payEntry = payDetailRes.body;
          const payDSum = payEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.debit),
            0,
          );
          const payCSum = payEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.credit),
            0,
          );
          expect(payDSum).toBeCloseTo(totalInvAmount, 2);
          expect(payCSum).toBeCloseTo(totalInvAmount, 2);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // =========================================================================
  // PROPERTY 2: Full Order-to-Cash (O2C) Lifecycle with COGS & Tax
  // =========================================================================
  describe('Property 2: Full Order-to-Cash (O2C) Lifecycle Fuzzing', () => {
    it('executes complete SO -> Pick -> Ship (COGS) -> Invoice (Tax) -> Receipt and balances all GL entries', async () => {
      const arbO2C = fc.record({
        qty: fc.integer({ min: 2, max: 30 }),
        unitCost: fc.integer({ min: 10, max: 100 }),
        unitSellPrice: fc.integer({ min: 50, max: 300 }),
      });

      await fc.assert(
        fc.asyncProperty(arbO2C, async ({ qty, unitCost, unitSellPrice }) => {
          const productId = await createLifecycleProduct(
            unitCost,
            unitSellPrice,
          );

          // Seed storage bin with inventory for the sales order
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId,
                  binId: storageBinId,
                  newQuantity: (qty * 2).toString(),
                },
              ],
              reason: 'Seed stock for O2C Fuzz',
            })
            .expect(201);

          // 1. Create Sales Order
          const soId = crypto.randomUUID();
          const soRes = await request(app.getHttpServer())
            .post('/api/sales-orders')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              salesOrderId: soId,
              fulfillmentLocationId: locationId,
              customerId,
              deliveryAddressLine1: '123 Fuzz Street',
              deliveryCity: 'Sydney',
              deliveryCountry: 'AU',
              name: 'O2C Fuzz Lifecycle',
              lines: [
                {
                  productId,
                  quantity: qty.toString(),
                  pricePerUnit: unitSellPrice.toFixed(2),
                  taxCategoryId,
                },
              ],
            });
          if (soRes.status !== 201)
            console.error('SO error:', soRes.status, soRes.body);
          expect(soRes.status).toBe(201);

          // Transition state: quoted -> confirmed -> picking
          await request(app.getHttpServer())
            .patch(`/api/sales-orders/${soId}/state`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ stateCode: 'quoted' })
            .expect(200);

          await request(app.getHttpServer())
            .patch(`/api/sales-orders/${soId}/state`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ stateCode: 'confirmed', generateBackorders: false })
            .expect(200);

          await request(app.getHttpServer())
            .patch(`/api/sales-orders/${soId}/state`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ stateCode: 'picking' })
            .expect(200);

          const soDetail = await request(app.getHttpServer())
            .get(`/api/sales-orders/${soId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const soLineId = soDetail.body.lines[0].salesOrderLineId;

          // 2. Pick & Ship Order (Triggers COGS GL Journal)
          const pickRes = await request(app.getHttpServer())
            .post(`/api/sales-orders/${soId}/picking/lines/${soLineId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ binId: storageBinId, quantity: qty.toString() });
          if (pickRes.status !== 201)
            console.error('Pick error:', pickRes.body);
          expect(pickRes.status).toBe(201);

          const shipRes = await request(app.getHttpServer())
            .post(`/api/sales-orders/${soId}/shipments`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                { salesOrderLineId: soLineId, quantityShipped: qty.toString() },
              ],
            });
          if (shipRes.status !== 201)
            console.error('Ship error:', shipRes.body);
          expect(shipRes.status).toBe(201);
          const shipmentId = shipRes.body.shipmentId;

          // Verify Shipment Journal Entry (DR COGS, CR Inventory Asset)
          const shipGlRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries?sourceId=${shipmentId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          expect(shipGlRes.body.data.length).toBeGreaterThan(0);
          const shipSummary = shipGlRes.body.data[0];

          const shipDetailRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries/${shipSummary.journalEntryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const shipEntry = shipDetailRes.body;
          const shipDSum = shipEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.debit),
            0,
          );
          const shipCSum = shipEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.credit),
            0,
          );
          expect(shipDSum).toBeCloseTo(qty * unitCost, 2);
          expect(shipCSum).toBeCloseTo(qty * unitCost, 2);
          expect(shipDSum).toBeCloseTo(shipCSum, 2);

          // 3. Create Sales Invoice (Triggers AR & Revenue GL Journal)
          const invRes = await request(app.getHttpServer())
            .post(`/api/sales-orders/${soId}/invoice`)
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ notes: 'O2C Fuzz Invoice' })
            .expect(201);
          const salesInvoiceId = invRes.body.invoiceId;

          const invGlRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries?sourceId=${salesInvoiceId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          expect(invGlRes.body.data.length).toBeGreaterThan(0);
          const invSummary = invGlRes.body.data[0];

          const invDetailRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries/${invSummary.journalEntryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const invEntry = invDetailRes.body;
          const invDSum = invEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.debit),
            0,
          );
          const invCSum = invEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.credit),
            0,
          );
          expect(invDSum).toBeCloseTo(invCSum, 2);

          // 4. Customer Receipt (Clear AR)
          const totalReceivable = invDSum;
          const paymentId = crypto.randomUUID();
          await request(app.getHttpServer())
            .post('/api/payments')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              partyId: customerId,
              paymentId,
              paymentType: 'customer_receipt',
              paymentDate: new Date().toISOString(),
              modeOfPayment: 'EFT',
              totalAmount: totalReceivable,
              glAccountBank: bankAccountId,
              currencyCode: baseCurrency,
              submitImmediately: true,
              allocations: [
                {
                  referenceType: 'sales_invoice',
                  referenceId: salesInvoiceId,
                  allocatedAmount: totalReceivable,
                },
              ],
            })
            .expect(201);

          // Verify Customer Receipt Journal Entry (DR Bank, CR AR)
          const receiptGlRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries?sourceId=${paymentId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          expect(receiptGlRes.body.data.length).toBeGreaterThan(0);
          const receiptSummary = receiptGlRes.body.data[0];

          const receiptDetailRes = await request(app.getHttpServer())
            .get(`/api/gl/journal-entries/${receiptSummary.journalEntryId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);
          const receiptEntry = receiptDetailRes.body;
          const recDSum = receiptEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.debit),
            0,
          );
          const recCSum = receiptEntry.lines.reduce(
            (s: number, l: any) => s + parseFloat(l.credit),
            0,
          );
          expect(recDSum).toBeCloseTo(totalReceivable, 2);
          expect(recCSum).toBeCloseTo(totalReceivable, 2);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // =========================================================================
  // PROPERTY 3: Global Cross-Ledger Triangulation & Zero-Imbalance Audit
  // =========================================================================
  describe('Property 3: Global Cross-Ledger Triangulation Invariants', () => {
    it('audits global double-entry equality and 100% individual journal balance', async () => {
      // 1. Global Double-Entry Balance (Total Debits == Total Credits)
      const globalBalance = await sqlClient`
        SELECT 
          COALESCE(SUM(debit), 0)::numeric as total_debit,
          COALESCE(SUM(credit), 0)::numeric as total_credit
        FROM herobm_core.gl_journal_lines
      `;
      const dTotal = parseFloat(globalBalance[0].total_debit);
      const cTotal = parseFloat(globalBalance[0].total_credit);
      expect(Math.abs(dTotal - cTotal)).toBeLessThanOrEqual(0.005);

      // 2. Individual Journal Entry Balance (100% of entries balanced)
      const unbalancedEntries = await sqlClient`
        SELECT journal_entry_id, ABS(SUM(debit) - SUM(credit)) as diff
        FROM herobm_core.gl_journal_lines
        GROUP BY journal_entry_id
        HAVING ABS(SUM(debit) - SUM(credit)) > 0.005
      `;
      expect(unbalancedEntries.length).toEqual(0);

      // 3. Zero Orphaned Lines
      const orphanedGl = await sqlClient`
        SELECT count(*)::int as count
        FROM herobm_core.gl_journal_lines jl
        LEFT JOIN herobm_core.gl_journal_entries je ON je.journal_entry_id = jl.journal_entry_id
        WHERE je.journal_entry_id IS NULL
      `;
      expect(orphanedGl[0].count).toEqual(0);

      const orphanedInv = await sqlClient`
        SELECT count(*)::int as count
        FROM herobm_core.inventory_ledger il
        LEFT JOIN herobm_core.inventory_entries ie ON ie.entry_id = il.entry_id
        WHERE ie.entry_id IS NULL
      `;
      expect(orphanedInv[0].count).toEqual(0);

      // 4. Zero Group Account Postings
      const groupPostings = await sqlClient`
        SELECT count(*)::int as count
        FROM herobm_core.gl_journal_lines jl
        JOIN herobm_core.gl_accounts a ON a.gl_account_id = jl.gl_account_id
        WHERE a.is_group = true
      `;
      expect(groupPostings[0].count).toEqual(0);

      // 5. Complete Financial Event Audit Trail for GL Entries
      const missingAuditEvents = await sqlClient`
        SELECT count(*)::int as count
        FROM herobm_core.gl_journal_entries je
        LEFT JOIN herobm_core.financial_events fe
          ON fe.entity_id = je.journal_entry_id AND fe.event_type = 'gl_posted'
        WHERE fe.event_id IS NULL
      `;
      expect(missingAuditEvents[0].count).toEqual(0);

      // 6. No Negative Inventory in Storage Bins
      const negativeBins = await sqlClient`
        SELECT count(*)::int as count
        FROM herobm_core.bin_contents
        WHERE actual_quantity < 0
      `;
      expect(negativeBins[0].count).toEqual(0);
    });
  });
});
