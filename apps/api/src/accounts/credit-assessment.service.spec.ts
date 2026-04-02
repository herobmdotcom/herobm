import { Test, TestingModule } from '@nestjs/testing';
import { CreditAssessmentService } from './credit-assessment.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('CreditAssessmentService', () => {
  let service: CreditAssessmentService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      leftJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      limit: jest.fn(),
      execute: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CreditAssessmentService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<CreditAssessmentService>(CreditAssessmentService);
  });

  describe('assessCredit', () => {
    it('returns zero balances if account missing', async () => {
      mockDb.limit.mockResolvedValueOnce([]); // No account found
      const result = await service.assessCredit('acct-1');
      expect(result).toEqual({
        totalArBalance: 0,
        overdueBalance: 0,
        isOverdue: false,
      });
    });

    it('calculates correct net AR balance', async () => {
      // Mock Account resolution -> NET30
      mockDb.limit.mockResolvedValueOnce([
        {
          accountId: 'acct-1',
          accountTradingTermsId: 'term-30',
          groupTradingTermsId: null,
        },
      ]);
      // Mock Terms resolution
      mockDb.limit.mockResolvedValueOnce([{ days: 30 }]);

      // Mock GL Aggregation
      mockDb.execute.mockResolvedValueOnce([
        {
          total_debits: '500',
          total_credits: '200',
          overdue_debits: '0',
        },
      ]);

      const result = await service.assessCredit('acct-1');
      expect(result.totalArBalance).toBe(300); // 500 - 200
      expect(result.overdueBalance).toBe(0); // MAX(0, 0 - 200) = 0
      expect(result.isOverdue).toBe(false);
    });

    it('identifies overdue balances accurately based on balance-forward', async () => {
      mockDb.limit.mockResolvedValueOnce([
        {
          accountId: 'acct-1',
          accountTradingTermsId: 'term-30',
        },
      ]);
      mockDb.limit.mockResolvedValueOnce([{ days: 30 }]);

      // Invoice 1: 50 days old = $1000 (Overdue)
      // Invoice 2: 10 days old = $500 (Current)
      // Payments so far: $400
      // Expected total debits: 1500
      // Expected overdue_debits: 1000
      // Expected total credits: 400
      // Net AR = 1100
      // Net Overdue = MAX(0, 1000 - 400) = 600

      mockDb.execute.mockResolvedValueOnce([
        {
          total_debits: '1500',
          total_credits: '400',
          overdue_debits: '1000',
        },
      ]);

      const result = await service.assessCredit('acct-1');
      expect(result.totalArBalance).toBe(1100);
      expect(result.overdueBalance).toBe(600);
      expect(result.isOverdue).toBe(true);
    });

    it('clears overdue bounds if total credits cover oldest debt', async () => {
      mockDb.limit.mockResolvedValueOnce([{ accountId: 'acct-1' }]);
      mockDb.limit.mockResolvedValueOnce([{ days: 30 }]);

      // Overdue debits = $1000
      // Cash paid = $1200
      // The $1200 pays off the $1000 old debt, leaving $200 for current debt.
      // Net Overdue = 0
      mockDb.execute.mockResolvedValueOnce([
        {
          total_debits: '1500',
          total_credits: '1200',
          overdue_debits: '1000',
        },
      ]);

      const result = await service.assessCredit('acct-1');
      expect(result.totalArBalance).toBe(300);
      expect(result.overdueBalance).toBe(0);
      expect(result.isOverdue).toBe(false);
    });
  });
});
