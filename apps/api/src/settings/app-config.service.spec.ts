import { Test, TestingModule } from '@nestjs/testing';
import { AppConfigService } from './app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('AppConfigService', () => {
  let service: AppConfigService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      limit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [AppConfigService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<AppConfigService>(AppConfigService);
  });

  describe('onModuleInit', () => {
    it('should load settings from both tables gracefully', async () => {
      // gl_settings returns a row
      const glRow = {
        settingsId: 'gl-1',
        fiscalYearStartMonth: 7,
        baseCurrency: 'AUD',
        revenueRoutingPrecedence: 'product_first',
        expenseRoutingPrecedence: 'product_first',
        defaultArAccountId: 'ar-1',
        defaultRevenueAccountId: 'rev-1',
        defaultTaxAccountId: 'tax-1',
      };
      // app_settings returns a row
      const appRow = {
        settingsId: 'app-1',
        defaultFulfillmentLocationId: 'loc-1',
        inventoryValuationMethod: 'weighted_average',
        nonStockBillingMode: 'per_shipment',
        setupCompletedAt: new Date(),
      };

      // First call (gl_settings)
      mockDb.limit
        .mockResolvedValueOnce([glRow])
        // Second call (app_settings)
        .mockResolvedValueOnce([appRow]);

      await service.onModuleInit();

      expect(service.homeCurrency()).toBe('AUD');
      expect(service.fiscalYearStartMonth()).toBe(7);
      expect(service.revenueRoutingPrecedence()).toBe('product_first');
      expect(service.expenseRoutingPrecedence()).toBe('product_first');
      expect(service.defaultFulfillmentLocationId()).toBe('loc-1');
      expect(service.valuationMethod()).toBe('weighted_average');
      expect(service.nonStockBillingMode()).toBe('per_shipment');
      expect(service.isSetupComplete()).toBe(true);
    });

    it('should fall back to defaults when tables are empty', async () => {
      mockDb.limit
        .mockResolvedValueOnce([]) // empty gl_settings
        .mockResolvedValueOnce([]); // empty app_settings

      await service.onModuleInit();

      expect(service.homeCurrency()).toBe('EUR'); // fallback
      expect(service.fiscalYearStartMonth()).toBe(7); // fallback
      expect(service.revenueRoutingPrecedence()).toBe('product_first');
      expect(service.expenseRoutingPrecedence()).toBe('product_first');
      expect(service.defaultFulfillmentLocationId()).toBeNull();
      expect(service.valuationMethod()).toBe('weighted_average');
      expect(service.nonStockBillingMode()).toBe('per_shipment');
      expect(service.isSetupComplete()).toBe(false);
    });

    it('should handle table-not-found errors gracefully (pre-migration)', async () => {
      mockDb.limit
        .mockRejectedValueOnce(
          new Error('relation "modbm_core.gl_settings" does not exist'),
        )
        .mockRejectedValueOnce(
          new Error('relation "modbm_core.app_settings" does not exist'),
        );

      await service.onModuleInit();

      // Should not throw, should fall back to defaults
      expect(service.homeCurrency()).toBe('EUR');
      expect(service.defaultFulfillmentLocationId()).toBeNull();
      expect(service.isSetupComplete()).toBe(false);
    });
  });

  describe('reload', () => {
    it('should refresh cached values when called', async () => {
      // Initial load: empty
      mockDb.limit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

      await service.onModuleInit();
      expect(service.homeCurrency()).toBe('EUR');

      // Reload after setup: now has data
      mockDb.limit
        .mockResolvedValueOnce([
          {
            settingsId: 'gl-2',
            baseCurrency: 'NZD',
            fiscalYearStartMonth: 4,
            revenueRoutingPrecedence: 'customer_first',
            expenseRoutingPrecedence: 'supplier_first',
          },
        ])
        .mockResolvedValueOnce([
          {
            settingsId: 'app-2',
            defaultFulfillmentLocationId: 'loc-99',
            inventoryValuationMethod: 'fifo',
            nonStockBillingMode: 'final_invoice',
            setupCompletedAt: new Date(),
          },
        ]);

      await service.reload();

      expect(service.homeCurrency()).toBe('NZD');
      expect(service.fiscalYearStartMonth()).toBe(4);
      expect(service.revenueRoutingPrecedence()).toBe('customer_first');
      expect(service.expenseRoutingPrecedence()).toBe('supplier_first');
      expect(service.defaultFulfillmentLocationId()).toBe('loc-99');
      expect(service.valuationMethod()).toBe('fifo');
      expect(service.nonStockBillingMode()).toBe('final_invoice');
      expect(service.isSetupComplete()).toBe(true);
    });
  });
});
