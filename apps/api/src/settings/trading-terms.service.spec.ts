import { Test, TestingModule } from '@nestjs/testing';
import { TradingTermsService } from './trading-terms.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { tradingTerms } from '@herobm/db-schema';

describe('TradingTermsService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: TradingTermsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TradingTermsService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<TradingTermsService>(TradingTermsService);
    await pg.db.delete(tradingTerms);
  });

  describe('findAll', () => {
    it('should return trading terms sorted naturally by code (e.g. D3 before D4 before D30)', async () => {
      await pg.db.insert(tradingTerms).values([
        {
          code: 'D30',
          description: '30 Days',
          days: 30,
          type: 'net',
          isActive: true,
        },
        {
          code: 'D3',
          description: '3 Days',
          days: 3,
          type: 'net',
          isActive: true,
        },
        {
          code: 'D4',
          description: '4 Days',
          days: 4,
          type: 'net',
          isActive: true,
        },
        {
          code: 'COD',
          description: 'Cash on Delivery',
          days: 0,
          type: 'cash_on_delivery',
          isActive: true,
        },
        {
          code: 'D10',
          description: '10 Days',
          days: 10,
          type: 'net',
          isActive: true,
        },
      ]);

      const result = await service.findAll();
      const codes = result.map((r) => r.code);
      expect(codes).toEqual(['COD', 'D3', 'D4', 'D10', 'D30']);
    });
  });

  describe('create and update', () => {
    it('should create a trading term and update it', async () => {
      const created = await service.create({
        code: 'NET14',
        description: '14 Days Net',
        days: 14,
        type: 'net',
      });

      expect(created.tradingTermsId).toBeDefined();
      expect(created.code).toBe('NET14');

      const updated = await service.update(created.tradingTermsId, {
        description: 'Updated 14 Days Net',
      });
      expect(updated.description).toBe('Updated 14 Days Net');
    });
  });
});
