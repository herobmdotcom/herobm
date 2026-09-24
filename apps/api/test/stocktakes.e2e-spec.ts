import { TestingModule } from '@nestjs/testing';
import { createE2eModule } from './utils/e2e-module';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { STOCKTAKE_STATE } from '@herobm/shared';

describe('Stocktakes & Cycle Counting (e2e)', () => {
  let app: INestApplication;
  let adminToken: string;
  let warehouseToken: string;
  let viewerToken: string;
  let baseUrl: any;

  let locationId: string;
  let zoneAId: string;
  let zoneBId: string;
  let binA1Id: string;
  let binA2Id: string;
  let binB1Id: string;

  let prod1Id: string;
  let prod2Id: string;
  let prod3Id: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await (
      await createE2eModule()
    ).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    baseUrl = process.env.TEST_API_URL || app.getHttpServer();

    // 1. Admin login
    const adminRes = await request(baseUrl)
      .post('/api/auth/login')
      .send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD || 'password',
      });
    expect(adminRes.status).toBe(201);
    adminToken = adminRes.body.access_token;

    // 2. Warehouse operator login
    const warehouseRes = await request(baseUrl)
      .post('/api/auth/login')
      .send({
        username: 'warehouse',
        password: process.env.DEV_WAREHOUSE_PASSWORD || 'password', // TEST_CREDENTIAL
      });
    expect(warehouseRes.status).toBe(201);
    warehouseToken = warehouseRes.body.access_token;

    // 3. Viewer login
    const viewerRes = await request(baseUrl)
      .post('/api/auth/login')
      .send({
        username: 'viewer',
        password: process.env.DEV_VIEWER_PASSWORD || 'password',
      });
    expect(viewerRes.status).toBe(201);
    viewerToken = viewerRes.body.access_token;

    // 4. Create Location, Zones, and Bins
    const locRes = await request(baseUrl)
      .post('/api/inventory/locations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        code: `STK-LOC-${Date.now()}`,
        name: 'Stocktake Test Warehouse',
        city: 'Sydney',
      });
    expect(locRes.status).toBe(201);
    locationId = locRes.body.locationId;

    const zoneARes = await request(baseUrl)
      .post('/api/inventory/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationId,
        code: `ZA-${Date.now().toString().slice(-4)}`,
        name: 'Zone A - High Density',
      });
    expect(zoneARes.status).toBe(201);
    zoneAId = zoneARes.body.zoneId;

    const zoneBRes = await request(baseUrl)
      .post('/api/inventory/zones')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        locationId,
        code: `ZB-${Date.now().toString().slice(-4)}`,
        name: 'Zone B - Bulk Pallet',
      });
    expect(zoneBRes.status).toBe(201);
    zoneBId = zoneBRes.body.zoneId;

    const binA1Res = await request(baseUrl)
      .post('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        zoneId: zoneAId,
        binNumber: 'A1-01',
        binType: 'storage',
      });
    expect(binA1Res.status).toBe(201);
    binA1Id = binA1Res.body.binId;

    const binA2Res = await request(baseUrl)
      .post('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        zoneId: zoneAId,
        binNumber: 'A1-02',
        binType: 'storage',
      });
    expect(binA2Res.status).toBe(201);
    binA2Id = binA2Res.body.binId;

    const binB1Res = await request(baseUrl)
      .post('/api/inventory/bins')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        zoneId: zoneBId,
        binNumber: 'B1-01',
        binType: 'storage',
      });
    expect(binB1Res.status).toBe(201);
    binB1Id = binB1Res.body.binId;

    // 5. Create 3 test products
    const prod1Res = await request(baseUrl)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `STK-P1-${Date.now()}`,
        name: 'Industrial Bolt Pack M8',
        listPrice: '15.00',
        productType: 'inventory',
        baseUom: 'EA',
      });
    expect(prod1Res.status).toBe(201);
    prod1Id = prod1Res.body.productId;

    const prod2Res = await request(baseUrl)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `STK-P2-${Date.now()}`,
        name: 'Stainless Steel Bracket 100mm',
        listPrice: '45.00',
        productType: 'inventory',
        baseUom: 'EA',
      });
    expect(prod2Res.status).toBe(201);
    prod2Id = prod2Res.body.productId;

    const prod3Res = await request(baseUrl)
      .post('/api/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productNumber: `STK-P3-${Date.now()}`,
        name: 'Unlisted Copper Fitting 20mm',
        listPrice: '22.50',
        productType: 'inventory',
        baseUom: 'EA',
      });
    expect(prod3Res.status).toBe(201);
    prod3Id = prod3Res.body.productId;

    // 6. Seed initial stock via /api/inventory/adjust
    //    PROD-1 in BIN-A1: 50 EA
    //    PROD-2 in BIN-A2: 30 EA
    //    PROD-1 in BIN-B1: 20 EA
    const adjustRes = await request(baseUrl)
      .post('/api/inventory/adjust')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        reason: 'Initial stock seeding for Stocktake E2E',
        lines: [
          { productId: prod1Id, binId: binA1Id, newQuantity: '50' },
          { productId: prod2Id, binId: binA2Id, newQuantity: '30' },
          { productId: prod1Id, binId: binB1Id, newQuantity: '20' },
        ],
      });
    expect([200, 201]).toContain(adjustRes.status);
  });

  afterAll(async () => {
    await app.close();
  });

  describe('1. Stocktake Creation & Scope Snapshotting', () => {
    let fullStocktakeId: string;
    let zoneStocktakeId: string;
    let manualStocktakeId: string;

    it('POST /api/inventory/stocktakes — creates full location stocktake and snapshots 3 lines', async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Annual Warehouse Full Stocktake',
          locationId,
          scopeType: 'full',
          isBlindCount: false,
          notes: 'Full audit of all bins',
        });

      expect(res.status).toBe(201);
      expect(res.body.stocktakeId).toBeDefined();
      expect(res.body.stocktakeNumber).toMatch(/^STK-\d{8}-\d{4}$/);
      expect(res.body.stateCode).toBe(STOCKTAKE_STATE.OPEN);
      expect(res.body.scopeType).toBe('full');
      fullStocktakeId = res.body.stocktakeId;

      // Verify lines snapshot
      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${fullStocktakeId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(linesRes.status).toBe(200);
      expect(linesRes.body.total).toBe(3);
      expect(linesRes.body.data.length).toBe(3);

      const expMap = new Map<string, string>(
        linesRes.body.data.map((l: any) => [
          `${l.productId}:${l.binId}`,
          l.expectedQuantity || '0',
        ]),
      );
      expect(parseFloat(expMap.get(`${prod1Id}:${binA1Id}`) || '0')).toBe(50);
      expect(parseFloat(expMap.get(`${prod2Id}:${binA2Id}`) || '0')).toBe(30);
      expect(parseFloat(expMap.get(`${prod1Id}:${binB1Id}`) || '0')).toBe(20);
    });

    it('POST /api/inventory/stocktakes — creates zone-scoped stocktake and snapshots only Zone A lines', async () => {
      // Get zone code
      const zoneRes = await request(baseUrl)
        .get(`/api/inventory/locations/${locationId}/bins`)
        .set('Authorization', `Bearer ${adminToken}`);
      const zoneACode =
        zoneRes.body?.find((b: any) => b.binId === binA1Id)?.zoneCode || 'ZA';

      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Zone A Cycle Count',
          locationId,
          scopeType: 'zone',
          zoneFilter: zoneACode,
          isBlindCount: false,
        });

      expect(res.status).toBe(201);
      zoneStocktakeId = res.body.stocktakeId;

      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${zoneStocktakeId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(linesRes.status).toBe(200);
      expect(linesRes.body.total).toBe(2);
      // Both lines belong to Zone A
      for (const line of linesRes.body.data) {
        expect([binA1Id, binA2Id]).toContain(line.binId);
      }
    });

    it('POST /api/inventory/stocktakes — creates manual stocktake with 0 initial snapshot lines', async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Manual Spot Check',
          locationId,
          scopeType: 'manual',
          isBlindCount: false,
        });

      expect(res.status).toBe(201);
      manualStocktakeId = res.body.stocktakeId;

      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${manualStocktakeId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(linesRes.status).toBe(200);
      expect(linesRes.body.total).toBe(0);
    });

    it('GET /api/inventory/stocktakes — filters stocktakes by location and state', async () => {
      const res = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes?locationId=${locationId}&stateCode=open`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
      for (const item of res.body.data) {
        expect(item.locationId).toBe(locationId);
        expect(item.stateCode).toBe(STOCKTAKE_STATE.OPEN);
      }
    });

    it('GET /api/inventory/stocktakes/:id — returns progress metrics', async () => {
      const res = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${fullStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.totalLines).toBe(3);
      expect(res.body.countedLines).toBe(0);
      expect(res.body.progressPercentage).toBe(0);
      expect(res.body.discrepancyLines).toBe(0);
    });
  });

  describe('2. Blind Count Masking Lifecycle', () => {
    let blindStocktakeId: string;

    it('POST /api/inventory/stocktakes — creates blind stocktake with expectedQuantity masked in OPEN state', async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Blind Stocktake Q3',
          locationId,
          scopeType: 'full',
          isBlindCount: true,
        });

      expect(res.status).toBe(201);
      blindStocktakeId = res.body.stocktakeId;
      expect(res.body.isBlindCount).toBe(true);

      // Header summary should mask discrepancyLines
      const headerRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${blindStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(headerRes.status).toBe(200);
      expect(headerRes.body.discrepancyLines).toBeNull();

      // Lines should have expectedQuantity = null and varianceQuantity = null
      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${blindStocktakeId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(linesRes.status).toBe(200);
      expect(linesRes.body.total).toBe(3);
      for (const line of linesRes.body.data) {
        expect(line.expectedQuantity).toBeNull();
        expect(line.varianceQuantity).toBeNull();
      }
    });

    it('POST /api/inventory/stocktakes/:id/counts — records count during blind mode', async () => {
      const countRes = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${blindStocktakeId}/counts`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          productId: prod1Id,
          binId: binA1Id,
          quantity: '48',
          countMode: 'set',
        });

      expect(countRes.status).toBe(201);
      expect(countRes.body.countedQuantity).toBe('48');

      // Still in OPEN state -> expected & variance remain masked
      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${blindStocktakeId}/lines`)
        .set('Authorization', `Bearer ${warehouseToken}`);

      const countedLine = linesRes.body.data.find(
        (l: any) => l.productId === prod1Id && l.binId === binA1Id,
      );
      expect(countedLine.countedQuantity).toBe('48');
      expect(countedLine.expectedQuantity).toBeNull();
      expect(countedLine.varianceQuantity).toBeNull();
    });

    it('POST /api/inventory/stocktakes/:id/state — transitions to REVIEW state and unmasks expected & variance quantities', async () => {
      const transRes = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${blindStocktakeId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          stateCode: STOCKTAKE_STATE.REVIEW,
          notes: 'Counting complete, beginning supervisor review',
        });

      expect(transRes.status).toBe(200);
      expect(transRes.body.stateCode).toBe(STOCKTAKE_STATE.REVIEW);

      // Header should now expose discrepancyLines
      const headerRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${blindStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(headerRes.status).toBe(200);
      expect(headerRes.body.discrepancyLines).not.toBeNull();
      expect(headerRes.body.discrepancyLines).toBe(1); // 48 vs 50 expected

      // Lines should now expose expectedQuantity and varianceQuantity
      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${blindStocktakeId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`);

      const countedLine = linesRes.body.data.find(
        (l: any) => l.productId === prod1Id && l.binId === binA1Id,
      );
      expect(parseFloat(countedLine.expectedQuantity)).toBe(50);
      expect(countedLine.varianceQuantity).toBe('-2');
      expect(countedLine.status).toBe('shortage');
    });
  });

  describe('3. Multi-Counter Concurrency & Audit Trail', () => {
    let concurrencyStocktakeId: string;

    beforeAll(async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Multi-Counter Concurrency Stocktake',
          locationId,
          scopeType: 'full',
          isBlindCount: false,
        });
      concurrencyStocktakeId = res.body.stocktakeId;
    });

    it('POST /api/inventory/stocktakes/:id/counts — Counter 1 records initial SET count', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${concurrencyStocktakeId}/counts`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          productId: prod1Id,
          binId: binA1Id,
          quantity: '40',
          countMode: 'set',
          notes: 'First pass count by Admin',
        });

      expect(res.status).toBe(201);
      expect(res.body.countedQuantity).toBe('40');
    });

    it('POST /api/inventory/stocktakes/:id/counts — Counter 2 records INCREMENT count', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${concurrencyStocktakeId}/counts`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          productId: prod1Id,
          binId: binA1Id,
          quantity: '5',
          countMode: 'increment',
          notes: 'Found 5 additional units at back of shelf by Warehouse',
        });

      expect(res.status).toBe(201);
      expect(res.body.countedQuantity).toBe('45');

      // Verify line aggregated quantity
      const linesRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${concurrencyStocktakeId}/lines?binId=${binA1Id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      const line = linesRes.body.data.find((l: any) => l.productId === prod1Id);
      expect(line.countedQuantity).toBe('45');
      expect(line.lastCountedBy).toBe('warehouse');
      expect(line.status).toBe('shortage'); // 45 vs 50 expected
    });

    it('GET /api/inventory/stocktakes/:id/counts — returns append-only audit trail with both counters', async () => {
      const res = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${concurrencyStocktakeId}/counts?binId=${binA1Id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.total).toBe(2);

      const adminCount = res.body.data.find(
        (c: any) => c.countedBy === 'admin',
      );
      const whCount = res.body.data.find(
        (c: any) => c.countedBy === 'warehouse',
      );

      expect(adminCount).toBeDefined();
      expect(adminCount.quantity).toBe('40');
      expect(adminCount.countMode).toBe('set');

      expect(whCount).toBeDefined();
      expect(whCount.quantity).toBe('5');
      expect(whCount.countMode).toBe('increment');
    });
  });

  describe('4. Batch Counting, Unlisted Products & Empty Bins', () => {
    let activeStocktakeId: string;
    let unlistedLineId: string;

    beforeAll(async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'End-to-End Reconciliation Stocktake',
          locationId,
          scopeType: 'full',
          isBlindCount: false,
        });
      activeStocktakeId = res.body.stocktakeId;
    });

    it('POST /api/inventory/stocktakes/:id/counts/batch — records multiple counts atomically', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${activeStocktakeId}/counts/batch`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          counts: [
            {
              productId: prod1Id,
              binId: binA1Id,
              quantity: '45', // -5 shortage
              countMode: 'set',
            },
            {
              productId: prod2Id,
              binId: binA2Id,
              quantity: '32', // +2 surplus
              countMode: 'set',
            },
          ],
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.count).toBe(2);

      // Verify line statuses
      const linesRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${activeStocktakeId}/lines`)
        .set('Authorization', `Bearer ${adminToken}`);

      const l1 = linesRes.body.data.find(
        (l: any) => l.productId === prod1Id && l.binId === binA1Id,
      );
      const l2 = linesRes.body.data.find(
        (l: any) => l.productId === prod2Id && l.binId === binA2Id,
      );

      expect(l1.countedQuantity).toBe('45');
      expect(l1.status).toBe('shortage');
      expect(l2.countedQuantity).toBe('32');
      expect(l2.status).toBe('surplus');
    });

    it('POST /api/inventory/stocktakes/:id/lines — adds unlisted product discovered in bin', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${activeStocktakeId}/lines`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          productId: prod3Id,
          binId: binA1Id,
          countedQuantity: '10',
          notes: 'Found in back corner of A1-01',
        });

      expect(res.status).toBe(201);
      expect(res.body.productId).toBe(prod3Id);
      expect(res.body.binId).toBe(binA1Id);
      expect(res.body.expectedQuantity).toBe('0');
      expect(res.body.countedQuantity).toBe('10');
      expect(res.body.isUnlisted).toBe(true);
      unlistedLineId = res.body.stocktakeLineId;

      // Verify filtered query for unlisted lines
      const unlistedRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines?isUnlisted=true`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(unlistedRes.status).toBe(200);
      expect(unlistedRes.body.total).toBe(1);
      expect(unlistedRes.body.data[0].stocktakeLineId).toBe(unlistedLineId);
    });

    it('PATCH /api/inventory/stocktakes/:id/lines/:lineId — updates line counted quantity and notes', async () => {
      const res = await request(baseUrl)
        .patch(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines/${unlistedLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          countedQuantity: '12',
          notes: 'Supervisor recount verified 12 units',
        });

      expect(res.status).toBe(200);
      expect(res.body.countedQuantity).toBe('12');
      expect(res.body.notes).toBe('Supervisor recount verified 12 units');
    });

    it('DELETE /api/inventory/stocktakes/:id/lines/:lineId — deletes a line from stocktake', async () => {
      const res = await request(baseUrl)
        .delete(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines/${unlistedLineId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const checkRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines?isUnlisted=true`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(checkRes.body.total).toBe(0);
    });

    it('POST /api/inventory/stocktakes/:id/bins/:binId/mark-empty — zeroes all remaining items in bin', async () => {
      // BIN-B1 has PROD-1 (expected 20) currently uncounted
      const uncountedRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines?status=uncounted`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(uncountedRes.body.total).toBe(1);
      expect(uncountedRes.body.data[0].binId).toBe(binB1Id);

      // Mark BIN-B1 empty
      const emptyRes = await request(baseUrl)
        .post(
          `/api/inventory/stocktakes/${activeStocktakeId}/bins/${binB1Id}/mark-empty`,
        )
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({ notes: 'Physically inspected BIN-B1 - completely empty' });

      expect(emptyRes.status).toBe(200);
      expect(emptyRes.body.success).toBe(true);
      expect(emptyRes.body.markedCount).toBe(1);

      // Verify line is now counted as 0
      const lineRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines?binId=${binB1Id}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(lineRes.body.data[0].countedQuantity).toBe('0');
      expect(lineRes.body.data[0].status).toBe('shortage');
    });

    it('GET /api/inventory/stocktakes/:id/lines — verifies discrepancy filters (match, surplus, shortage)', async () => {
      const surplusRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines?status=surplus`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(surplusRes.body.total).toBe(1);
      expect(surplusRes.body.data[0].productId).toBe(prod2Id);

      const shortageRes = await request(baseUrl)
        .get(
          `/api/inventory/stocktakes/${activeStocktakeId}/lines?status=shortage`,
        )
        .set('Authorization', `Bearer ${adminToken}`);
      expect(shortageRes.body.total).toBe(2); // PROD-1 in BIN-A1 and BIN-B1
    });
  });

  describe('5. Submission, Reconciliation & Immutability Enforcement', () => {
    let reconcilableStocktakeId: string;

    beforeAll(async () => {
      // Create stocktake for full reconciliation test
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Fiscal Year End Full Reconciliation',
          locationId,
          scopeType: 'full',
        });
      reconcilableStocktakeId = res.body.stocktakeId;
    });

    it('POST /api/inventory/stocktakes/:id/submit — rejects submission when uncounted items remain', async () => {
      // Only count line 1
      await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/counts`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          productId: prod1Id,
          binId: binA1Id,
          quantity: '45',
        });

      // Submit should fail because line 2 and 3 are uncounted
      const submitRes = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Premature submit' });

      expect(submitRes.status).toBe(400);
      expect(submitRes.body.message).toMatch(/item\(s\) remain uncounted/i);
    });

    it('POST /api/inventory/stocktakes/:id/submit — successfully reconciles and adjusts inventory', async () => {
      // Complete remaining counts:
      // Line 2: PROD-2 in BIN-A2 -> count 32 (+2 surplus)
      await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/counts`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          productId: prod2Id,
          binId: binA2Id,
          quantity: '32',
        });

      // Line 3: PROD-1 in BIN-B1 -> mark empty (0)
      await request(baseUrl)
        .post(
          `/api/inventory/stocktakes/${reconcilableStocktakeId}/bins/${binB1Id}/mark-empty`,
        )
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({});

      // Transition to review
      await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: STOCKTAKE_STATE.REVIEW });

      // Submit reconciliation
      const submitRes = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Year-End Certified Reconciliation' });

      expect(submitRes.status).toBe(200);
      expect(submitRes.body.success).toBe(true);
      expect(submitRes.body.stateCode).toBe(STOCKTAKE_STATE.SUBMITTED);
      expect(submitRes.body.reconciledCount).toBe(3); // all 3 had variances (-5, +2, -20)
      expect(submitRes.body.inventoryEntryId).toBeDefined();

      // Verify live stock balances via /api/inventory/by-products
      const stockRes = await request(baseUrl)
        .get(
          `/api/inventory/by-products?productIds=${prod1Id},${prod2Id}&locationId=${locationId}`,
        )
        .set('Authorization', `Bearer ${adminToken}`);

      expect(stockRes.status).toBe(200);
      const prod1Stock = stockRes.body.find(
        (p: any) => p.productId === prod1Id,
      );
      const prod2Stock = stockRes.body.find(
        (p: any) => p.productId === prod2Id,
      );

      // PROD-1 total: 45 (45 in BIN-A1, 0 in BIN-B1)
      expect(parseFloat(prod1Stock.quantityOnHand)).toBe(45);
      // PROD-2 total: 32 (in BIN-A2)
      expect(parseFloat(prod2Stock.quantityOnHand)).toBe(32);
    });

    it('POST /api/inventory/stocktakes/:id/submit — returns 409 Conflict when submitting already submitted stocktake', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/submit`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'Duplicate submission attempt' });

      expect(res.status).toBe(409);
      expect(res.body.message).toMatch(/already been submitted/i);
    });

    it('POST /api/inventory/stocktakes/:id/counts — returns 400 when attempting to record counts on submitted stocktake', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${reconcilableStocktakeId}/counts`)
        .set('Authorization', `Bearer ${warehouseToken}`)
        .send({
          productId: prod1Id,
          binId: binA1Id,
          quantity: '50',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/must be open/i);
    });

    it('PATCH /api/inventory/stocktakes/:id — returns 400 when modifying submitted stocktake', async () => {
      const res = await request(baseUrl)
        .patch(`/api/inventory/stocktakes/${reconcilableStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notes: 'Attempted post-submission change' });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(
        /cannot modify stocktake in submitted state/i,
      );
    });

    it('DELETE /api/inventory/stocktakes/:id — returns 400 when attempting to delete submitted stocktake', async () => {
      const res = await request(baseUrl)
        .delete(`/api/inventory/stocktakes/${reconcilableStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/only draft stocktakes can be deleted/i);
    });
  });

  describe('6. State Machine Transitions & Draft Deletion', () => {
    let draftStocktakeId: string;

    it('POST /api/inventory/stocktakes/:id/state — transitions open -> draft -> deleted', async () => {
      // Create stocktake
      const createRes = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Cancelled Inventory Count',
          locationId,
          scopeType: 'manual',
        });
      draftStocktakeId = createRes.body.stocktakeId;

      // Transition open -> draft
      const draftRes = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${draftStocktakeId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: STOCKTAKE_STATE.DRAFT });

      expect(draftRes.status).toBe(200);
      expect(draftRes.body.stateCode).toBe(STOCKTAKE_STATE.DRAFT);

      // Attempt invalid transition: draft -> submitted directly
      const invalidTrans = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${draftStocktakeId}/state`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ stateCode: STOCKTAKE_STATE.SUBMITTED });

      expect(invalidTrans.status).toBe(400);
      expect(invalidTrans.body.message).toMatch(
        /cannot transition stocktake from draft to submitted/i,
      );

      // Delete draft stocktake
      const deleteRes = await request(baseUrl)
        .delete(`/api/inventory/stocktakes/${draftStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(deleteRes.status).toBe(200);
      expect(deleteRes.body.success).toBe(true);

      // Verify it is gone
      const getRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${draftStocktakeId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(getRes.status).toBe(404);
    });
  });

  describe('7. RBAC & Access Control Enforcement', () => {
    let rbacStocktakeId: string;

    beforeAll(async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'RBAC Access Test Stocktake',
          locationId,
          scopeType: 'manual',
        });
      rbacStocktakeId = res.body.stocktakeId;
    });

    it('POST /api/inventory/stocktakes — denies viewer role (403 Forbidden)', async () => {
      const res = await request(baseUrl)
        .post('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          name: 'Unauthorized Stocktake',
          locationId,
          scopeType: 'manual',
        });

      expect(res.status).toBe(403);
    });

    it('POST /api/inventory/stocktakes/:id/counts — denies viewer role (403 Forbidden)', async () => {
      const res = await request(baseUrl)
        .post(`/api/inventory/stocktakes/${rbacStocktakeId}/counts`)
        .set('Authorization', `Bearer ${viewerToken}`)
        .send({
          productId: prod1Id,
          binId: binA1Id,
          quantity: '10',
        });

      expect(res.status).toBe(403);
    });

    it('GET /api/inventory/stocktakes — permits viewer role to read stocktakes and lines (200 OK)', async () => {
      const res = await request(baseUrl)
        .get('/api/inventory/stocktakes')
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(res.status).toBe(200);

      const oneRes = await request(baseUrl)
        .get(`/api/inventory/stocktakes/${rbacStocktakeId}`)
        .set('Authorization', `Bearer ${viewerToken}`);

      expect(oneRes.status).toBe(200);
    });
  });
});
