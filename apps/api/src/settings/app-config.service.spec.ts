import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from './app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { glSettings, appSettings, locations } from '@herobm/db-schema';
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import * as schema from '@herobm/db-schema';

describe('AppConfigService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: AppConfigService;
  let testLocationId: string;

  beforeEach(async () => {
    const [loc] = await pg.db
      .insert(locations)
      .values({
        name: 'Test Wh',
        code: 'TWH',
        source: 'app',
        createdBy: 'system',
      })
      .returning();
    testLocationId = loc.locationId;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);

    // Clean tables
    await pg.db.delete(glSettings);
    await pg.db.delete(appSettings);
  });

  describe('onModuleInit', () => {
    it('should load settings from both tables', async () => {
      await pg.db.insert(glSettings).values({
        fiscalYearStartMonth: 7,
        baseCurrency: 'AUD',
        revenueRoutingPrecedence: 'product_first',
        expenseRoutingPrecedence: 'product_first',
        bankMatchDateToleranceDays: 0,
      });

      await pg.db.insert(appSettings).values({
        defaultFulfillmentLocationId: testLocationId,
        inventoryValuationMethod: 'weighted_average',
        inventoryAccountingMode: 'periodic',
        setupCompletedAt: new Date(),
        creditLimitBehavior: 'block',
        apiRateLimit: '100',
      });

      await service.onModuleInit();

      expect(service.homeCurrency()).toBe('AUD');
      expect(service.fiscalYearStartMonth()).toBe(7);
      expect(service.isSetupComplete()).toBe(true);
      expect(service.defaultFulfillmentLocationId()).toBe(testLocationId);
    });

    it('should fall back to error when tables are empty', async () => {
      await service.onModuleInit();

      expect(() => service.homeCurrency()).toThrow(
        'GL Settings not configured',
      );
      expect(service.isSetupComplete()).toBe(false);
    });

    it('should handle missing tables gracefully (pre-migration)', async () => {
      // Create a fresh client without migrations
      const rawClient = new PGlite();
      const rawDb = drizzle(rawClient, { schema });

      const module: TestingModule = await Test.createTestingModule({
        providers: [AppConfigService, { provide: DRIZZLE, useValue: pg.db }],
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

      await pg.db.insert(glSettings).values({
        fiscalYearStartMonth: 4,
        baseCurrency: 'NZD',
        revenueRoutingPrecedence: 'customer_first',
        expenseRoutingPrecedence: 'supplier_first',
        bankMatchDateToleranceDays: 0,
      });

      await pg.db.insert(appSettings).values({
        defaultFulfillmentLocationId: testLocationId,
        inventoryValuationMethod: 'fifo',
        inventoryAccountingMode: 'perpetual',
        setupCompletedAt: new Date(),
        creditLimitBehavior: 'block',
        apiRateLimit: '100',
      });

      await service.reload();

      expect(service.homeCurrency()).toBe('NZD');
      expect(service.fiscalYearStartMonth()).toBe(4);
      expect(service.isSetupComplete()).toBe(true);
      expect(service.defaultFulfillmentLocationId()).toBe(testLocationId);
    });

    it('should persist and load salesAnalysisCodes', async () => {
      const [created] = await pg.db
        .insert(appSettings)
        .values({
          defaultFulfillmentLocationId: testLocationId,
          inventoryValuationMethod: 'fifo',
          inventoryAccountingMode: 'perpetual',
          setupCompletedAt: new Date(),
          creditLimitBehavior: 'soft',
          apiRateLimit: '100',
          salesAnalysisCodes: [
            { value: 'EAST', order: 1 },
            { value: 'WEST', order: 2 },
          ],
        })
        .returning();

      await service.reload();
      const raw = service.getAppSettingsRaw();
      expect(raw?.salesAnalysisCodes).toEqual([
        { value: 'EAST', order: 1 },
        { value: 'WEST', order: 2 },
      ]);
    });
  });
});
