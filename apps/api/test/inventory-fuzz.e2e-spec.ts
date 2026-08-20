/**
 * Inventory Property-Based Fuzz Testing E2E Test Suite
 *
 * Uses fast-check to test the robustness of the Inventory Ledger and its real-time
 * snapshot cache (bin_contents), ensuring strict stock conservation, multi-bin move
 * symmetry, negative stock prevention, multi-UOM conversion precision, quarantine
 * isolation, polymorphic putaway lifecycle, and financial shrinkage/gain GL integration.
 */
import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as fc from 'fast-check';
import postgres from 'postgres';
import { v4 as uuidv4 } from 'uuid';
import { AppConfigService } from '../src/settings/app-config.service';

interface TestBin {
  binId: string;
  binNumber: string;
  binType: string;
  zoneId: string;
  zoneCode: string;
  locationId: string;
}

const RANDOM_SEED = process.env.FUZZ_SEED
  ? parseInt(process.env.FUZZ_SEED, 10)
  : Date.now();

const NUM_RUNS = process.env.FUZZ_RUNS
  ? parseInt(process.env.FUZZ_RUNS, 10)
  : 20;

console.log(
  `\n[Fuzz Setup] Running Hardened Inventory E2E Fuzz Suite with RANDOM_SEED = ${RANDOM_SEED}, NUM_RUNS = ${NUM_RUNS}\n`,
);

describe('API E2E — Inventory Ledger Fuzz & Robustness Suite', () => {
  let app: INestApplication;
  let adminToken: string;
  let sqlClient: postgres.Sql;

  let locationId: string;
  let storageZoneId: string;
  let handlingZoneId: string;
  let secondaryLocationId: string;
  let defaultVendorId: string;

  let inventoryAccountId: string;
  let shrinkageAccountId: string;

  const createProduct = async (
    prefix: string,
    cost = '25.00',
    baseUom = 'EA',
  ) => {
    const res = await request(app.getHttpServer())
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `FUZZ-${prefix}-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000)}`,
        name: `Fuzz Product ${prefix}`,
        listPrice: '100.00',
        standardCost: cost,
        weightedAverageCost: cost,
        productType: 'inventory',
        baseUom,
      })
      .expect(201);
    return res.body.productId as string;
  };

  const createIsolatedBins = async (
    prefix: string,
    count: number,
    binType: 'storage' | 'quarantine' = 'storage',
    targetZoneId?: string,
  ): Promise<TestBin[]> => {
    const binsList: TestBin[] = [];
    const zId = targetZoneId || storageZoneId;
    for (let i = 0; i < count; i++) {
      const binId = uuidv4();
      const binNum = `${prefix}-${Date.now().toString(36).toUpperCase()}-${i}`;
      await sqlClient`
        INSERT INTO herobm_core.bins (bin_id, bin_number, zone_id, bin_type, source, created_by)
        VALUES (${binId}::uuid, ${binNum}, ${zId}::uuid, ${binType}, 'test', 'system')
      `;
      binsList.push({
        binId,
        binNumber: binNum,
        binType,
        zoneId: zId,
        zoneCode: 'STORAGE',
        locationId,
      });
    }
    return binsList;
  };

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
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

    // 2. Direct Postgres connection for deep invariant auditing
    const user = process.env.POSTGRES_USER || 'postgres';
    const host = process.env.POSTGRES_HOST || '127.0.0.1';
    const port = process.env.POSTGRES_PORT || '5432';
    const db = process.env.POSTGRES_DB || 'herobm_local';
    const connectionString =
      process.env.DATABASE_URL ||
      `postgresql://${user}:${process.env.POSTGRES_PASSWORD || 'password'}@${host}:${port}/${db}`;
    sqlClient = postgres(connectionString);

    // 3. Resolve Primary Location & Topography
    const locRes = await request(app.getHttpServer())
      .get('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    const mainLoc =
      locRes.body.find((l: any) => l.code === 'MAIN') || locRes.body[0];
    locationId = mainLoc.locationId;

    // 4. Resolve Secondary Location (for cross-location tests)
    const otherLoc = locRes.body.find((l: any) => l.locationId !== locationId);
    if (otherLoc) {
      secondaryLocationId = otherLoc.locationId;
    } else {
      const newLocId = uuidv4();
      await sqlClient`
        INSERT INTO herobm_core.locations (location_id, code, name, source, created_by)
        VALUES (${newLocId}::uuid, 'SEC_LOC', 'Secondary Test Location', 'test', 'system')
      `;
      secondaryLocationId = newLocId;
    }

    // 5. Resolve / Create Storage Zone for Testing
    const storageZones = await sqlClient`
      SELECT zone_id, code FROM herobm_core.zones 
      WHERE location_id = ${locationId}::uuid AND code != 'HANDLING'
      LIMIT 1
    `;
    if (storageZones.length === 0) {
      const newZoneId = uuidv4();
      await sqlClient`
        INSERT INTO herobm_core.zones (zone_id, location_id, code, name, source, created_by)
        VALUES (${newZoneId}::uuid, ${locationId}::uuid, 'MAIN_STORAGE', 'Main Storage Zone', 'test', 'system')
      `;
      storageZoneId = newZoneId;
    } else {
      storageZoneId = storageZones[0].zone_id;
    }

    // 6. Resolve / Create HANDLING Zone and RECEIVING Bin
    const handlingZones = await sqlClient`
      SELECT zone_id, code FROM herobm_core.zones 
      WHERE location_id = ${locationId}::uuid AND code = 'HANDLING'
      LIMIT 1
    `;
    if (handlingZones.length === 0) {
      const newHandlingId = uuidv4();
      await sqlClient`
        INSERT INTO herobm_core.zones (zone_id, location_id, code, name, source, created_by)
        VALUES (${newHandlingId}::uuid, ${locationId}::uuid, 'HANDLING', 'Handling Zone', 'test', 'system')
      `;
      handlingZoneId = newHandlingId;
    } else {
      handlingZoneId = handlingZones[0].zone_id;
    }

    // Ensure RECEIVING bin exists in handling zone
    await sqlClient`
      INSERT INTO herobm_core.bins (bin_id, bin_number, zone_id, bin_type, source, created_by)
      VALUES (${uuidv4()}::uuid, 'RECEIVING', ${handlingZoneId}::uuid, 'staging', 'test', 'system')
      ON CONFLICT DO NOTHING
    `;

    // Ensure standard UoMs exist in dictionary
    await sqlClient`
      INSERT INTO herobm_core.uom_dictionary (uom_code, description)
      VALUES 
        ('EA', 'Each'),
        ('BOX', 'Box of 10'),
        ('CASE', 'Case of 50'),
        ('PK', 'Pack of 5')
      ON CONFLICT (uom_code) DO NOTHING
    `;

    // Ensure a test vendor/supplier exists
    const [supplier] = await sqlClient`
      SELECT vendor_id FROM herobm_core.suppliers LIMIT 1
    `;
    if (supplier) {
      defaultVendorId = supplier.vendor_id;
    } else {
      const newVendorId = uuidv4();
      await sqlClient`
        INSERT INTO herobm_core.suppliers (vendor_id, name, supplier_code, source, created_by)
        VALUES (${newVendorId}::uuid, 'Test Vendor', 'TEST-VEND-01', 'test', 'system')
      `;
      defaultVendorId = newVendorId;
    }

    // 7. Ensure GL Settings and Default Accounts are configured for Perpetual Accounting
    const existingAccounts = await sqlClient`
      SELECT gl_account_id, account_code, account_type, is_group, is_active
      FROM herobm_core.gl_accounts
      WHERE is_active = true AND is_group = false
    `;
    const assetAccount =
      existingAccounts.find((a) => a.account_type === 'asset') ||
      existingAccounts[0];
    const expenseAccount =
      existingAccounts.find((a) => a.account_type === 'expense') ||
      existingAccounts[1];

    inventoryAccountId = assetAccount.gl_account_id;
    shrinkageAccountId = expenseAccount.gl_account_id;

    await sqlClient`
      UPDATE herobm_core.gl_settings
      SET 
        default_inventory_account_id = ${inventoryAccountId}::uuid,
        default_shrinkage_account_id = ${shrinkageAccountId}::uuid
      WHERE true
    `;

    // Reload AppConfigService cache to pickup newly configured GL settings
    const appConfig = app.get(AppConfigService);
    await appConfig.reload();
  });

  afterAll(async () => {
    if (sqlClient) await sqlClient.end();
    if (app) await app.close();
  });

  // =========================================================================
  // PROPERTY 1: Bin Contents Cache Equality with Immutable Ledger
  // =========================================================================
  describe('Property 1: Bin Contents Cache Equality with Immutable Ledger', () => {
    let p1Products: string[] = [];
    let p1Bins: TestBin[] = [];

    beforeAll(async () => {
      p1Bins = await createIsolatedBins('P1-BIN', 4, 'storage');
      p1Products = [];
      for (let i = 0; i < 3; i++) {
        p1Products.push(await createProduct(`P1-${i}`));
      }
    });

    it('always maintains bin_contents.actual_quantity == SUM(inventory_ledger.quantity)', async () => {
      const arbSingleAdjustment = fc.record({
        productId: fc.constantFrom(...p1Products),
        binId: fc.constantFrom(...p1Bins.map((b) => b.binId)),
        quantity: fc.integer({ min: 1, max: 500 }),
      });

      const arbAdjustmentBatch = fc.uniqueArray(arbSingleAdjustment, {
        selector: (a) => `${a.productId}:${a.binId}`,
        minLength: 1,
        maxLength: 6,
      });

      await fc.assert(
        fc.asyncProperty(arbAdjustmentBatch, async (adjustments) => {
          const lines = adjustments.map((adj) => ({
            productId: adj.productId,
            binId: adj.binId,
            newQuantity: adj.quantity.toString(),
          }));

          const res = await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines,
              reason: 'Fuzz Property 1 Adjustment',
            });

          expect([200, 201]).toContain(res.status);

          for (const line of lines) {
            const ledgerSumRes = await sqlClient`
              SELECT COALESCE(SUM(quantity), 0)::numeric as ledger_total
              FROM herobm_core.inventory_ledger
              WHERE bin_id = ${line.binId}::uuid AND product_id = ${line.productId}::uuid
            `;
            const ledgerTotal = parseFloat(ledgerSumRes[0].ledger_total);

            const cacheRes = await sqlClient`
              SELECT COALESCE(actual_quantity, 0)::numeric as cache_qty
              FROM herobm_core.bin_contents
              WHERE bin_id = ${line.binId}::uuid AND product_id = ${line.productId}::uuid
            `;
            const cacheQty =
              cacheRes.length > 0 ? parseFloat(cacheRes[0].cache_qty) : 0;

            expect(cacheQty).toBeCloseTo(ledgerTotal, 2);
          }
        }),
        { numRuns: NUM_RUNS, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 2: Stock Move Conservation & Multi-Product Batch Invariant
  // =========================================================================
  describe('Property 2: Bin-to-Bin Move Conservation & Multi-Product Batches', () => {
    let p2Products: string[] = [];
    let p2Bins: TestBin[] = [];

    beforeAll(async () => {
      p2Bins = await createIsolatedBins('P2-BIN', 4, 'storage');
      p2Products = [];
      for (let i = 0; i < 3; i++) {
        const prod = await createProduct(`P2-MOVE-${i}`);
        p2Products.push(prod);

        await request(app.getHttpServer())
          .post('/api/inventory/adjust')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            lines: [
              {
                productId: prod,
                binId: p2Bins[0].binId,
                newQuantity: '50000',
              },
            ],
            reason: `Seed stock for P2-${i}`,
          })
          .expect(201);
      }
    });

    it('conserves total product inventory across source and destination bins in multi-line moves', async () => {
      const arbMoveLine = fc.record({
        productIdx: fc.integer({ min: 0, max: p2Products.length - 1 }),
        srcBinIdx: fc.constant(0),
        dstBinIdx: fc.integer({ min: 1, max: p2Bins.length - 1 }),
        quantity: fc.integer({ min: 1, max: 100 }),
      });

      const arbBatchMoves = fc.array(arbMoveLine, {
        minLength: 1,
        maxLength: 4,
      });

      await fc.assert(
        fc.asyncProperty(arbBatchMoves, async (moves) => {
          const preTotals = new Map<string, number>();
          for (const prod of p2Products) {
            const preTotalRes = await sqlClient`
              SELECT COALESCE(SUM(actual_quantity), 0)::numeric as total_qty
              FROM herobm_core.bin_contents
              WHERE product_id = ${prod}::uuid
            `;
            preTotals.set(prod, parseFloat(preTotalRes[0].total_qty));
          }

          const moveLines = moves.map((m) => ({
            productId: p2Products[m.productIdx],
            sourceBinId: p2Bins[m.srcBinIdx].binId,
            targetBinId: p2Bins[m.dstBinIdx].binId,
            quantity: m.quantity.toString(),
          }));

          const memo = `Fuzz Batch Move Conservation ${Date.now()}`;
          const moveRes = await request(app.getHttpServer())
            .post('/api/inventory/move')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: moveLines,
              reason: memo,
            });

          expect([200, 201]).toContain(moveRes.status);

          for (const prod of p2Products) {
            const postTotalRes = await sqlClient`
              SELECT COALESCE(SUM(actual_quantity), 0)::numeric as total_qty
              FROM herobm_core.bin_contents
              WHERE product_id = ${prod}::uuid
            `;
            const postTotal = parseFloat(postTotalRes[0].total_qty);
            expect(postTotal).toEqual(preTotals.get(prod));
          }

          const lastEntryRes = await sqlClient`
            SELECT entry_id FROM herobm_core.inventory_entries
            WHERE memo = ${memo}
            ORDER BY created_on DESC LIMIT 1
          `;
          if (lastEntryRes.length > 0) {
            const linesRes = await sqlClient`
              SELECT COALESCE(SUM(quantity), 0)::numeric as entry_sum
              FROM herobm_core.inventory_ledger
              WHERE entry_id = ${lastEntryRes[0].entry_id}::uuid
            `;
            expect(parseFloat(linesRes[0].entry_sum)).toEqual(0);
          }
        }),
        { numRuns: 15, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 3: Insufficient Stock Protection (Atomicity Guard)
  // =========================================================================
  describe('Property 3: Insufficient Stock Protection & Atomicity', () => {
    let p3Product: string;
    let p3Product2: string;
    let p3Bins: TestBin[] = [];

    beforeAll(async () => {
      p3Bins = await createIsolatedBins('P3-BIN', 3, 'storage');
      p3Product = await createProduct('P3-UNDERFLOW-1');
      p3Product2 = await createProduct('P3-UNDERFLOW-2');

      await request(app.getHttpServer())
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              productId: p3Product,
              binId: p3Bins[0].binId,
              newQuantity: '10',
            },
            {
              productId: p3Product2,
              binId: p3Bins[0].binId,
              newQuantity: '50',
            },
          ],
          reason: 'Set initial stock for P3',
        })
        .expect(201);
    });

    it('rejects moves exceeding available bin stock and writes 0 partial ledger lines (atomic rollback)', async () => {
      const arbExcessiveQty = fc.integer({ min: 11, max: 100000 });

      await fc.assert(
        fc.asyncProperty(arbExcessiveQty, async (excessiveQty) => {
          const preLedgerCountRes = await sqlClient`
            SELECT count(*)::int as count FROM herobm_core.inventory_ledger
          `;
          const preCount = preLedgerCountRes[0].count;

          const res = await request(app.getHttpServer())
            .post('/api/inventory/move')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p3Product2,
                  sourceBinId: p3Bins[0].binId,
                  targetBinId: p3Bins[1].binId,
                  quantity: '5',
                },
                {
                  productId: p3Product,
                  sourceBinId: p3Bins[0].binId,
                  targetBinId: p3Bins[1].binId,
                  quantity: excessiveQty.toString(),
                },
              ],
              reason: 'Mixed valid and excessive move attempt',
            });

          expect(res.status).toBe(400);

          const postLedgerCountRes = await sqlClient`
            SELECT count(*)::int as count FROM herobm_core.inventory_ledger
          `;
          const postCount = postLedgerCountRes[0].count;
          expect(postCount).toBe(preCount);

          const prod2CacheRes = await sqlClient`
            SELECT actual_quantity::numeric as qty FROM herobm_core.bin_contents
            WHERE bin_id = ${p3Bins[0].binId}::uuid AND product_id = ${p3Product2}::uuid
          `;
          expect(parseFloat(prod2CacheRes[0].qty)).toEqual(50);
        }),
        { numRuns: 10, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 4: Stock Adjustment Symmetry Invariant
  // =========================================================================
  describe('Property 4: Adjustment Symmetry (Q0 -> Q1 -> Q0)', () => {
    let p4Product: string;
    let p4Bins: TestBin[] = [];

    beforeAll(async () => {
      p4Bins = await createIsolatedBins('P4-BIN', 2, 'storage');
      p4Product = await createProduct('P4-SYMMETRY');
    });

    it('restores exact bin level and nets ledger entries to zero upon reverse adjustment', async () => {
      const bin = p4Bins[0];

      const arbQuantities = fc.tuple(
        fc.integer({ min: 10, max: 100 }),
        fc.integer({ min: 101, max: 300 }),
      );

      await fc.assert(
        fc.asyncProperty(arbQuantities, async ([q0, q1]) => {
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p4Product,
                  binId: bin.binId,
                  newQuantity: q0.toString(),
                },
              ],
              reason: 'Step 1: Set to Q0',
            })
            .expect(201);

          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p4Product,
                  binId: bin.binId,
                  newQuantity: q1.toString(),
                },
              ],
              reason: 'Step 2: Adjust to Q1',
            })
            .expect(201);

          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p4Product,
                  binId: bin.binId,
                  newQuantity: q0.toString(),
                },
              ],
              reason: 'Step 3: Revert to Q0',
            })
            .expect(201);

          const cacheRes = await sqlClient`
            SELECT actual_quantity::numeric as qty
            FROM herobm_core.bin_contents
            WHERE bin_id = ${bin.binId}::uuid AND product_id = ${p4Product}::uuid
          `;
          expect(parseFloat(cacheRes[0].qty)).toEqual(q0);
        }),
        { numRuns: 10, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 5: Quarantine Stock Segregation & Re-release Invariant
  // =========================================================================
  describe('Property 5: Quarantine Stock Segregation & Lifecycle', () => {
    let p5Product: string;
    let p5StorageBins: TestBin[] = [];
    let p5QuarantineBins: TestBin[] = [];

    beforeAll(async () => {
      p5StorageBins = await createIsolatedBins('P5-STOR', 2, 'storage');
      p5QuarantineBins = await createIsolatedBins('P5-QUAR', 2, 'quarantine');
      p5Product = await createProduct('P5-QUARANTINE');
    });

    it('isolates stock in quarantine from available inventory, and restores it when unquarantined', async () => {
      const qBin = p5QuarantineBins[0];
      const sBin = p5StorageBins[0];

      const arbQuarantineQty = fc.integer({ min: 10, max: 500 });

      await fc.assert(
        fc.asyncProperty(arbQuarantineQty, async (qty) => {
          // 1. Seed stock in quarantine bin and reset storage bin to 0
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p5Product,
                  binId: qBin.binId,
                  newQuantity: qty.toString(),
                },
                {
                  productId: p5Product,
                  binId: sBin.binId,
                  newQuantity: '0',
                },
              ],
              reason: 'Seed Quarantine Stock & Reset Storage',
            })
            .expect(201);

          // 2. Fetch inventory summary from API for primary location
          const invRes = await request(app.getHttpServer())
            .get(`/api/inventory?locationId=${locationId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          const allLevels = invRes.body.data || invRes.body || [];
          const level = allLevels.find(
            (l: any) =>
              l.productId === p5Product && l.locationId === locationId,
          );
          if (level) {
            const available = parseFloat(level.quantityAvailable || '0');
            expect(available).toEqual(0);
          }

          // 3. Move half of stock out of quarantine into storage bin via API
          const moveQty = Math.floor(qty / 2);
          const unquarantineRes = await request(app.getHttpServer())
            .post('/api/inventory/quarantine/move')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              productId: p5Product,
              sourceBinId: qBin.binId,
              targetBinId: sBin.binId,
              quantity: moveQty.toString(),
              sourceType: 'manual',
              reason: 'Unquarantine stock test',
            });

          expect([200, 201]).toContain(unquarantineRes.status);

          // 4. Verify available quantity equals moveQty
          const updatedInvRes = await request(app.getHttpServer())
            .get(`/api/inventory?locationId=${locationId}`)
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200);

          const updatedLevels =
            updatedInvRes.body.data || updatedInvRes.body || [];
          const updatedLevel = updatedLevels.find(
            (l: any) =>
              l.productId === p5Product && l.locationId === locationId,
          );
          expect(updatedLevel).toBeDefined();
          expect(parseFloat(updatedLevel!.quantityAvailable || '0')).toEqual(
            moveQty,
          );

          // Cleanup bin stock for next fuzz cycle
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                { productId: p5Product, binId: qBin.binId, newQuantity: '0' },
                { productId: p5Product, binId: sBin.binId, newQuantity: '0' },
              ],
              reason: 'Clean P5',
            })
            .expect(201);
        }),
        { numRuns: 10, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 6: Financial Shrinkage & Gain Balanced GL Integration (Bidirectional)
  // =========================================================================
  describe('Property 6: Financial Shrinkage & Gain Balanced GL Integration', () => {
    let p6Product: string;
    let p6Bins: TestBin[] = [];
    const UNIT_COST = '30.00';

    beforeAll(async () => {
      p6Bins = await createIsolatedBins('P6-BIN', 2, 'storage');
      p6Product = await createProduct('P6-SHRINKAGE', UNIT_COST);
    });

    it('creates matching balanced GL entries with exact account identities for both Losses and Gains', async () => {
      const bin = p6Bins[0];

      const arbAdjustments = fc
        .record({
          startQty: fc.integer({ min: 10, max: 200 }),
          endQty: fc.integer({ min: 1, max: 200 }),
        })
        .filter((a) => a.startQty !== a.endQty);

      await fc.assert(
        fc.asyncProperty(arbAdjustments, async ({ startQty, endQty }) => {
          // 1. Seed initial stock
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p6Product,
                  binId: bin.binId,
                  newQuantity: startQty.toString(),
                },
              ],
              reason: `Initial seed ${startQty}`,
            })
            .expect(201);

          const expectedDelta = endQty - startQty;
          const isLoss = expectedDelta < 0;
          const deltaAbs = Math.abs(expectedDelta);
          const expectedValue = deltaAbs * parseFloat(UNIT_COST);
          const memo = `GL Adjustment ${Date.now()}-${startQty}->${endQty}`;

          // 2. Perform adjustment
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p6Product,
                  binId: bin.binId,
                  newQuantity: endQty.toString(),
                },
              ],
              reason: memo,
            })
            .expect(201);

          // 3. Find created inventory entry
          const [lastInvEntry] = await sqlClient`
            SELECT entry_id, entry_number, source_type
            FROM herobm_core.inventory_entries
            WHERE memo = ${memo}
            ORDER BY created_on DESC LIMIT 1
          `;
          expect(lastInvEntry).toBeDefined();
          expect(lastInvEntry.source_type).toEqual('MANUAL_ADJUST');

          // Verify ledger delta
          const ledgerRes = await sqlClient`
            SELECT quantity::numeric as delta
            FROM herobm_core.inventory_ledger
            WHERE entry_id = ${lastInvEntry.entry_id}::uuid AND product_id = ${p6Product}::uuid
          `;
          expect(parseFloat(ledgerRes[0].delta)).toEqual(expectedDelta);

          // 4. Verify GL Journal Entry (Unconditional Assertion)
          const glEntries = await sqlClient`
            SELECT journal_entry_id, entry_number, source_type, source_id
            FROM herobm_core.gl_journal_entries
            WHERE source_id = ${lastInvEntry.entry_id}::uuid
          `;

          expect(glEntries.length).toBeGreaterThan(0);
          const glEntry = glEntries[0];
          expect(glEntry.source_type).toEqual('inventory_adjustment');

          const glLines = await sqlClient`
            SELECT 
              gl_account_id,
              debit::numeric as debit,
              credit::numeric as credit
            FROM herobm_core.gl_journal_lines
            WHERE journal_entry_id = ${glEntry.journal_entry_id}::uuid
          `;

          expect(glLines.length).toBeGreaterThanOrEqual(2);

          const totalDebit = glLines.reduce(
            (sum, l) => sum + parseFloat(l.debit),
            0,
          );
          const totalCredit = glLines.reduce(
            (sum, l) => sum + parseFloat(l.credit),
            0,
          );

          // Double-entry balance
          expect(totalDebit).toBeCloseTo(totalCredit, 2);
          expect(totalDebit).toBeCloseTo(expectedValue, 2);

          // Verify specific account mapping identity
          if (isLoss) {
            // LOSS: Debit Shrinkage Expense, Credit Inventory Asset
            const shrinkLine = glLines.find(
              (l) => l.gl_account_id === shrinkageAccountId,
            );
            const invLine = glLines.find(
              (l) => l.gl_account_id === inventoryAccountId,
            );

            expect(shrinkLine).toBeDefined();
            expect(invLine).toBeDefined();
            expect(parseFloat(shrinkLine!.debit)).toBeCloseTo(expectedValue, 2);
            expect(parseFloat(shrinkLine!.credit)).toBeCloseTo(0, 2);
            expect(parseFloat(invLine!.debit)).toBeCloseTo(0, 2);
            expect(parseFloat(invLine!.credit)).toBeCloseTo(expectedValue, 2);
          } else {
            // GAIN: Debit Inventory Asset, Credit Shrinkage/Gain
            const shrinkLine = glLines.find(
              (l) => l.gl_account_id === shrinkageAccountId,
            );
            const invLine = glLines.find(
              (l) => l.gl_account_id === inventoryAccountId,
            );

            expect(shrinkLine).toBeDefined();
            expect(invLine).toBeDefined();
            expect(parseFloat(invLine!.debit)).toBeCloseTo(expectedValue, 2);
            expect(parseFloat(invLine!.credit)).toBeCloseTo(0, 2);
            expect(parseFloat(shrinkLine!.debit)).toBeCloseTo(0, 2);
            expect(parseFloat(shrinkLine!.credit)).toBeCloseTo(
              expectedValue,
              2,
            );
          }
        }),
        { numRuns: 10, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 7: Zero-Quantity Cache Deletion (Garbage Collection Invariant)
  // =========================================================================
  describe('Property 7: Zero-Quantity Cache Deletion & History Retention', () => {
    let p7Product: string;
    let p7Bins: TestBin[] = [];

    beforeAll(async () => {
      p7Bins = await createIsolatedBins('P7-BIN', 2, 'storage');
      p7Product = await createProduct('P7-CLEANUP');
    });

    it('deletes rows in bin_contents when stock reaches 0 while retaining complete ledger history', async () => {
      const bin = p7Bins[0];
      const arbInitialQty = fc.integer({ min: 10, max: 200 });

      await fc.assert(
        fc.asyncProperty(arbInitialQty, async (qty) => {
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p7Product,
                  binId: bin.binId,
                  newQuantity: qty.toString(),
                },
              ],
              reason: `Set to ${qty}`,
            })
            .expect(201);

          const preCache = await sqlClient`
            SELECT count(*)::int as count
            FROM herobm_core.bin_contents
            WHERE bin_id = ${bin.binId}::uuid AND product_id = ${p7Product}::uuid
          `;
          expect(preCache[0].count).toEqual(1);

          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p7Product,
                  binId: bin.binId,
                  newQuantity: '0',
                },
              ],
              reason: 'Set to 0',
            })
            .expect(201);

          const cacheRes = await sqlClient`
            SELECT count(*)::int as count
            FROM herobm_core.bin_contents
            WHERE bin_id = ${bin.binId}::uuid AND product_id = ${p7Product}::uuid
          `;
          expect(cacheRes[0].count).toEqual(0);

          const ledgerHistory = await sqlClient`
            SELECT quantity::numeric as qty
            FROM herobm_core.inventory_ledger
            WHERE bin_id = ${bin.binId}::uuid AND product_id = ${p7Product}::uuid
            ORDER BY ledger_id
          `;
          expect(ledgerHistory.length).toBeGreaterThanOrEqual(2);
          const netSum = ledgerHistory.reduce(
            (s, r) => s + parseFloat(r.qty),
            0,
          );
          expect(netSum).toBeCloseTo(0, 2);
        }),
        { numRuns: 10, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 8: Multi-UOM Conversion Precision & Conservation
  // =========================================================================
  describe('Property 8: Multi-UOM Conversion Precision & Conservation', () => {
    let p8Product: string;
    let p8Bins: TestBin[] = [];

    beforeAll(async () => {
      p8Bins = await createIsolatedBins('P8-BIN', 3, 'storage');
      p8Product = await createProduct('P8-UOM', '15.00', 'EA');

      // Register secondary UoM conversion ratios: BOX = 10 EA, CASE = 50 EA
      await sqlClient`
        INSERT INTO herobm_core.product_uoms (product_id, uom_code, ratio)
        VALUES 
          (${p8Product}::uuid, 'BOX', '10'),
          (${p8Product}::uuid, 'CASE', '50')
        ON CONFLICT (product_id, uom_code) DO UPDATE SET ratio = EXCLUDED.ratio
      `;
    });

    it('accurately converts secondary UoM moves (BOX=10, CASE=50) to base units in ledger and cache', async () => {
      const srcBin = p8Bins[0];
      const dstBin = p8Bins[1];

      const arbUomMove = fc.record({
        moveUnits: fc.integer({ min: 1, max: 10 }),
        uomChoice: fc.constantFrom(
          { uom: 'BOX', ratio: 10 },
          { uom: 'CASE', ratio: 50 },
        ),
      });

      await fc.assert(
        fc.asyncProperty(
          arbUomMove,
          async ({ moveUnits, uomChoice: { uom, ratio } }) => {
            // Seed stock to 1000 base EA and reset dstBin to 0 before each move
            await request(app.getHttpServer())
              .post('/api/inventory/adjust')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({
                lines: [
                  {
                    productId: p8Product,
                    binId: srcBin.binId,
                    newQuantity: '1000',
                  },
                  {
                    productId: p8Product,
                    binId: dstBin.binId,
                    newQuantity: '0',
                  },
                ],
                reason: 'Seed stock for UoM fuzzing iteration',
              })
              .expect(201);

            const expectedBaseQuantityMoved = moveUnits * ratio;

            const memo = `Multi-UoM Move ${uom}-${Date.now()}-${Math.random()}`;
            const res = await request(app.getHttpServer())
              .post('/api/inventory/move')
              .set('Authorization', `Bearer ${adminToken}`)
              .send({
                lines: [
                  {
                    productId: p8Product,
                    sourceBinId: srcBin.binId,
                    targetBinId: dstBin.binId,
                    quantity: moveUnits.toString(),
                    uomCode: uom,
                  },
                ],
                reason: memo,
              });

            expect([200, 201]).toContain(res.status);

            // Verify the created ledger entry converted to base units
            const [lastEntry] = await sqlClient`
              SELECT entry_id FROM herobm_core.inventory_entries
              WHERE memo = ${memo}
              ORDER BY created_on DESC LIMIT 1
            `;
            expect(lastEntry).toBeDefined();

            const entryLines = await sqlClient`
              SELECT bin_id, quantity::numeric as qty
              FROM herobm_core.inventory_ledger
              WHERE entry_id = ${lastEntry.entry_id}::uuid
            `;
            expect(entryLines.length).toEqual(2);

            const srcLine = entryLines.find((l) => l.bin_id === srcBin.binId);
            const dstLine = entryLines.find((l) => l.bin_id === dstBin.binId);

            expect(srcLine).toBeDefined();
            expect(dstLine).toBeDefined();
            expect(parseFloat(srcLine!.qty)).toEqual(
              -expectedBaseQuantityMoved,
            );
            expect(parseFloat(dstLine!.qty)).toEqual(expectedBaseQuantityMoved);

            // Verify cache was updated by exact base units
            const postSrcCacheRes = await sqlClient`
              SELECT COALESCE(actual_quantity, 0)::numeric as qty
              FROM herobm_core.bin_contents
              WHERE bin_id = ${srcBin.binId}::uuid AND product_id = ${p8Product}::uuid
            `;
            const postSrcQty = parseFloat(postSrcCacheRes[0]?.qty || '0');
            expect(postSrcQty).toEqual(1000 - expectedBaseQuantityMoved);
          },
        ),
        { numRuns: 10, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 9: Putaway Multi-Source Flow & Lifecycle Invariant
  // =========================================================================
  describe('Property 9: Putaway Multi-Source Flow & Lifecycle', () => {
    let p9Product: string;
    let p9DestBin: TestBin;
    let receivingBinId: string;

    beforeAll(async () => {
      const bins = await createIsolatedBins('P9-PUT', 2, 'storage');
      p9DestBin = bins[0];
      p9Product = await createProduct('P9-PUTAWAY');

      // Resolve RECEIVING bin
      const [rBin] = await sqlClient`
        SELECT bin_id FROM herobm_core.bins
        JOIN herobm_core.zones ON bins.zone_id = zones.zone_id
        WHERE zones.location_id = ${locationId}::uuid AND bins.bin_number = 'RECEIVING'
        LIMIT 1
      `;
      receivingBinId = rBin.bin_id;
    });

    it('transfers stock from RECEIVING to destination bin and transitions putaway status to COMPLETED', async () => {
      const arbPutawayQty = fc.integer({ min: 10, max: 100 });

      await fc.assert(
        fc.asyncProperty(arbPutawayQty, async (qty) => {
          // 1. Seed stock into RECEIVING bin
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p9Product,
                  binId: receivingBinId,
                  newQuantity: qty.toString(),
                },
              ],
              reason: 'Seed Receiving Bin for Putaway',
            })
            .expect(201);

          // 2. Create Goods Received Record in DB
          const grId = uuidv4();
          const grLineId = uuidv4();
          const receiptNum = `GR-${Date.now().toString(36).toUpperCase()}-${Math.floor(Math.random() * 10000)}`;

          await sqlClient`
            INSERT INTO herobm_core.goods_received (goods_received_id, location_id, receipt_number, vendor_id, state_code, created_by)
            VALUES (${grId}::uuid, ${locationId}::uuid, ${receiptNum}, ${defaultVendorId}::uuid, 'received', 'system')
          `;

          await sqlClient`
            INSERT INTO herobm_core.goods_received_lines (goods_received_line_id, goods_received_id, product_id, quantity_received, putaway_status, match_status)
            VALUES (${grLineId}::uuid, ${grId}::uuid, ${p9Product}::uuid, ${qty.toString()}, 'pending_putaway', 'matched')
          `;

          // 3. Execute Putaway via API
          const putawayRes = await request(app.getHttpServer())
            .post('/api/inventory/putaway')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              putaways: [
                {
                  sourceType: 'goods_receipt',
                  lineId: grLineId,
                  destinationBinId: p9DestBin.binId,
                  quantity: qty.toString(),
                  reason: 'Fuzz Putaway Execution',
                },
              ],
            });

          expect([200, 201]).toContain(putawayRes.status);

          // 4. Verify line status transitioned to COMPLETED
          const [updatedGrLine] = await sqlClient`
            SELECT putaway_status FROM herobm_core.goods_received_lines
            WHERE goods_received_line_id = ${grLineId}::uuid
          `;
          expect(updatedGrLine.putaway_status).toEqual('completed');

          // 5. Verify stock moved to destination bin
          const destCacheRes = await sqlClient`
            SELECT actual_quantity::numeric as qty FROM herobm_core.bin_contents
            WHERE bin_id = ${p9DestBin.binId}::uuid AND product_id = ${p9Product}::uuid
          `;
          expect(parseFloat(destCacheRes[0].qty)).toBeGreaterThanOrEqual(qty);

          // Cleanup destination bin
          await request(app.getHttpServer())
            .post('/api/inventory/adjust')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({
              lines: [
                {
                  productId: p9Product,
                  binId: p9DestBin.binId,
                  newQuantity: '0',
                },
              ],
              reason: 'Cleanup Putaway Dest',
            })
            .expect(201);
        }),
        { numRuns: 5, seed: RANDOM_SEED },
      );
    });
  });

  // =========================================================================
  // PROPERTY 10: Negative Boundaries & Business Rule Rejection
  // =========================================================================
  describe('Property 10: Negative Boundaries & Business Rule Rejections', () => {
    let p10Product: string;
    let localBin: TestBin;
    let otherLocBinId: string;
    let handlingBinId: string;
    let receivingBinId: string;
    let quarantineBinId: string;

    beforeAll(async () => {
      const localBins = await createIsolatedBins('P10-LOCAL', 1, 'storage');
      localBin = localBins[0];
      p10Product = await createProduct('P10-BOUNDS');

      // Create bin in secondary location
      const [secZone] = await sqlClient`
        SELECT zone_id FROM herobm_core.zones WHERE location_id = ${secondaryLocationId}::uuid LIMIT 1
      `;
      let secZId = secZone?.zone_id;
      if (!secZId) {
        secZId = uuidv4();
        await sqlClient`
          INSERT INTO herobm_core.zones (zone_id, location_id, code, name, source, created_by)
          VALUES (${secZId}::uuid, ${secondaryLocationId}::uuid, 'SEC_ZONE', 'Sec Zone', 'test', 'system')
        `;
      }
      otherLocBinId = uuidv4();
      await sqlClient`
        INSERT INTO herobm_core.bins (bin_id, bin_number, zone_id, bin_type, source, created_by)
        VALUES (${otherLocBinId}::uuid, 'BIN-SEC-LOC', ${secZId}::uuid, 'storage', 'test', 'system')
      `;

      // Resolve HANDLING and RECEIVING bins
      const [hBin] = await sqlClient`
        SELECT bin_id FROM herobm_core.bins WHERE zone_id = ${handlingZoneId}::uuid LIMIT 1
      `;
      handlingBinId = hBin.bin_id;

      const [rBin] = await sqlClient`
        SELECT bin_id FROM herobm_core.bins WHERE bin_number = 'RECEIVING' LIMIT 1
      `;
      receivingBinId = rBin.bin_id;

      const qBins = await createIsolatedBins('P10-Q', 1, 'quarantine');
      quarantineBinId = qBins[0].binId;

      // Seed 100 stock in local bin
      await request(app.getHttpServer())
        .post('/api/inventory/adjust')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              productId: p10Product,
              binId: localBin.binId,
              newQuantity: '100',
            },
            {
              productId: p10Product,
              binId: receivingBinId,
              newQuantity: '100',
            },
            {
              productId: p10Product,
              binId: quarantineBinId,
              newQuantity: '100',
            },
          ],
          reason: 'Seed stock for boundary rejections',
        })
        .expect(201);
    });

    it('rejects cross-location stock moves with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/move')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              productId: p10Product,
              sourceBinId: localBin.binId,
              targetBinId: otherLocBinId,
              quantity: '10',
            },
          ],
          reason: 'Attempt cross location move',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Cannot move stock between different locations',
      );
    });

    it('rejects manual moves into HANDLING zone bins with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/move')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              productId: p10Product,
              sourceBinId: localBin.binId,
              targetBinId: handlingBinId,
              quantity: '10',
            },
          ],
          reason: 'Attempt move into handling bin',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Cannot manually move stock into system HANDLING bins',
      );
    });

    it('rejects manual moves out of RECEIVING bins with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/move')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              productId: p10Product,
              sourceBinId: receivingBinId,
              targetBinId: localBin.binId,
              quantity: '10',
            },
          ],
          reason: 'Attempt move out of receiving bin',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Cannot manually move stock out of RECEIVING bins',
      );
    });

    it('rejects un-quarantining to a quarantine bin with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/quarantine/move')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: p10Product,
          sourceBinId: quarantineBinId,
          targetBinId: quarantineBinId,
          quantity: '10',
          sourceType: 'manual',
          reason: 'Attempt unquarantine to quarantine bin',
        });
      expect(res.status).toBe(400);
      expect(res.body.message).toContain(
        'Target bin cannot be a quarantine bin when unquarantining',
      );
    });

    it('rejects non-positive quantities with 400 Bad Request', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/inventory/move')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          lines: [
            {
              productId: p10Product,
              sourceBinId: localBin.binId,
              targetBinId: localBin.binId,
              quantity: '0',
            },
          ],
          reason: 'Attempt zero qty move',
        });
      expect(res.status).toBe(400);
    });
  });
});
