import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from './app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { createMemoryDb } from '../../test/utils/memory-db';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { glSettings, appSettings, locations } from '../drizzle/modbm-core-schema';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '../drizzle/modbm-core-schema';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let db: PgliteDatabase<any>;
  let client: any;
  let testLocationId: string;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
    client = mem.client;

    const [loc] = await db.insert(locations).values({
      name: 'Test Wh',
      code: 'TWH',
    }).returning();
    testLocationId = loc.locationId;
  });

  afterAll(async () => {
    await client.close();
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);

    // Clean tables
    await db.delete(glSettings);
    await db.delete(appSettings);
  });

  describe('onModuleInit', () => {
    it('should load settings from both tables', async () => {
      await db.insert(glSettings).values({
        fiscalYearStartMonth: 7,
        baseCurrency: 'AUD',
        revenueRoutingPrecedence: 'product_first',
        expenseRoutingPrecedence: 'product_first',
      });

      await db.insert(appSettings).values({
        defaultFulfillmentLocationId: testLocationId,
        inventoryValuationMethod: 'weighted_average',
        nonStockBillingMode: 'per_shipment',
        setupCompletedAt: new Date(),
      });

      await service.onModuleInit();

      expect(service.homeCurrency()).toBe('AUD');
      expect(service.fiscalYearStartMonth()).toBe(7);
      expect(service.isSetupComplete()).toBe(true);
      expect(service.defaultFulfillmentLocationId()).toBe(testLocationId);
    });

    it('should fall back to error when tables are empty', async () => {
      await service.onModuleInit();

      expect(() => service.homeCurrency()).toThrow('GL Settings not configured');
      expect(service.isSetupComplete()).toBe(false);
    });

    it('should handle missing tables gracefully (pre-migration)', async () => {
      // Create a fresh client without migrations
      const rawClient = new PGlite();
      const rawDb = drizzle(rawClient, { schema });

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          AppConfigService,
          { provide: DRIZZLE, useValue: rawDb },
        ],
      }).compile();

      const freshService = module.get<AppConfigService>(AppConfigService);
      
      // Should not crash
      await freshService.onModuleInit();
      expect(freshService.isSetupComplete()).toBe(false);
      
      await rawClient.close();
    });
  });

  describe('reload', () => {
    it('should refresh cached values', async () => {
      await service.onModuleInit();
      expect(service.isSetupComplete()).toBe(false);

      await db.insert(glSettings).values({
        fiscalYearStartMonth: 4,
        baseCurrency: 'NZD',
        revenueRoutingPrecedence: 'customer_first',
        expenseRoutingPrecedence: 'supplier_first',
      });

      await db.insert(appSettings).values({
        defaultFulfillmentLocationId: testLocationId,
        inventoryValuationMethod: 'fifo',
        nonStockBillingMode: 'final_invoice',
        setupCompletedAt: new Date(),
      });

      await service.reload();

      expect(service.homeCurrency()).toBe('NZD');
      expect(service.fiscalYearStartMonth()).toBe(4);
      expect(service.isSetupComplete()).toBe(true);
      expect(service.defaultFulfillmentLocationId()).toBe(testLocationId);
    });
  });
});
