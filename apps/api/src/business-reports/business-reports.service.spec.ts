import { Test, TestingModule } from '@nestjs/testing';
import { BusinessReportsService } from './business-reports.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { CASBIN_ENFORCER } from '../auth/casbin.provider';
import { businessReports } from '@herobm/db-schema';

describe('BusinessReportsService', () => {
  const pg = setupPgliteSuite();
  let service: BusinessReportsService;
  let registry: DataSourcesRegistry;
  let mockEnforcer: { enforce: jest.Mock };

  beforeEach(async () => {
    mockEnforcer = { enforce: jest.fn().mockResolvedValue(true) };
    registry = new DataSourcesRegistry();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BusinessReportsService,
        { provide: DRIZZLE, useValue: pg.db },
        { provide: DataSourcesRegistry, useValue: registry },
        { provide: CASBIN_ENFORCER, useValue: mockEnforcer },
      ],
    }).compile();

    service = module.get<BusinessReportsService>(BusinessReportsService);
  });

  describe('runReport date filter handling', () => {
    const TEST_SLUG = 'test-sales-report';
    const TEST_HOOK = 'test-sales-hook';

    beforeAll(async () => {
      await pg.db.insert(businessReports).values({
        slug: TEST_SLUG,
        name: 'Test Sales Report',
        dataSourceHook: TEST_HOOK,
        isSystem: true,
        uiConfig: {},
      });
    });

    it('should forward direct fromDate and toDate filters', async () => {
      let receivedFilters: any = null;
      registry.register(TEST_HOOK as any, {
        fetchData: async (filters) => {
          receivedFilters = filters;
          return [{ result: 'ok' }];
        },
      });

      const res = await service.runReport(
        TEST_SLUG,
        { fromDate: '2026-08-01', toDate: '2026-08-20' },
        { role: 'admin' },
      );

      expect(res).toEqual([{ result: 'ok' }]);
      expect(receivedFilters).toEqual({
        fromDate: '2026-08-01',
        toDate: '2026-08-20',
      });
    });

    it('should resolve absolute _dateRange and remove _dateRange key', async () => {
      let receivedFilters: any = null;
      registry.register(TEST_HOOK as any, {
        fetchData: async (filters) => {
          receivedFilters = filters;
          return [{ result: 'ok' }];
        },
      });

      const res = await service.runReport(
        TEST_SLUG,
        {
          _dateRange: {
            mode: 'absolute',
            from: '2026-08-01',
            to: '2026-08-23',
          },
        },
        { role: 'admin' },
      );

      expect(res).toEqual([{ result: 'ok' }]);
      expect(receivedFilters).toEqual({
        fromDate: '2026-08-01',
        toDate: '2026-08-23',
      });
      expect(receivedFilters?._dateRange).toBeUndefined();
    });

    it('should resolve relative _dateRange and remove _dateRange key', async () => {
      let receivedFilters: any = null;
      registry.register(TEST_HOOK as any, {
        fetchData: async (filters) => {
          receivedFilters = filters;
          return [{ result: 'ok' }];
        },
      });

      const res = await service.runReport(
        TEST_SLUG,
        {
          _dateRange: {
            mode: 'relative',
            n: 7,
            unit: 'days',
            fullCalendar: false,
          },
        },
        { role: 'admin' },
      );

      expect(res).toEqual([{ result: 'ok' }]);
      expect(receivedFilters?.fromDate).toBeDefined();
      expect(receivedFilters?.toDate).toBeDefined();
      expect(receivedFilters?._dateRange).toBeUndefined();
    });
  });
});
