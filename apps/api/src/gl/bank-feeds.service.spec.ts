import { Test, TestingModule } from '@nestjs/testing';
import { BankFeedsService } from './bank-feeds.service';
import { GlService } from './gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('BankFeedsService', () => {
  let service: BankFeedsService;
  let dbMock: Record<string, jest.Mock>;
  let glServiceMock: { postJournalEntry: jest.Mock };

  beforeEach(async () => {
    dbMock = {
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      values: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      returning: jest.fn().mockResolvedValue([{}]),
      limit: jest.fn().mockReturnThis(),
      transaction: jest.fn(),
    };

    glServiceMock = {
      postJournalEntry: jest.fn().mockResolvedValue({ journalEntryId: '123' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BankFeedsService,
        { provide: DRIZZLE, useValue: dbMock },
        { provide: GlService, useValue: glServiceMock },
      ],
    }).compile();

    service = module.get<BankFeedsService>(BankFeedsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseCsvHeaders', () => {
    it('should parse headers and rows correctly', async () => {
      const csvData = Buffer.from(
        'Date,Amount,Description\n2023-01-01,100,Test\n2023-01-02,-50,Fee',
      );
      const result = await service.parseCsvHeaders(csvData);

      expect(result.headers).toEqual(['Date', 'Amount', 'Description']);
      expect(result.sampleRows).toHaveLength(2);
      expect(result.sampleRows[0]).toEqual(['2023-01-01', '100', 'Test']);
    });

    it('should throw error for empty CSV', async () => {
      const csvData = Buffer.from('');
      await expect(service.parseCsvHeaders(csvData)).rejects.toThrow(
        'CSV file is empty or invalid.',
      );
    });
  });

  describe('importCsv', () => {
    beforeEach(() => {
      dbMock.select.mockReturnThis();
      dbMock.from.mockReturnThis();
      dbMock.where.mockReturnThis();
      dbMock.orderBy.mockReturnThis();
      dbMock.transaction.mockImplementation(
        async (cb: (tx: Record<string, jest.Mock>) => Promise<unknown>) => {
          return cb(dbMock);
        },
      );
    });

    it('should correctly evaluate rules and post journal entries for matched rows', async () => {
      // 1. fetch mapping profile
      dbMock.where.mockResolvedValueOnce([
        {
          profileId: 'prof-1',
          headerRows: 1,
          dateColumn: '0',
          amountColumn: '1',
          descriptionColumn: '2',
          referenceColumn: '3',
        },
      ]);

      // 2. fetch rules (importCsv)
      dbMock.orderBy.mockResolvedValueOnce([
        {
          ruleId: 'rule-1',
          conditionType: 'contains',
          conditionValue: 'STRIPE',
          targetGlAccountId: 'target-acc-1',
        },
      ]);

      // 3. fetch bank account code (importCsv)
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // 4. fetch rules (executeAutoMatching)
      dbMock.orderBy.mockResolvedValueOnce([
        {
          ruleId: 'rule-1',
          conditionType: 'contains',
          conditionValue: 'STRIPE',
          targetGlAccountId: 'target-acc-1',
        },
      ]);

      // 5. fetch bank account code (executeAutoMatching)
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // Inside transaction:
      // 6. fetch unreconciled lines
      dbMock.where.mockResolvedValueOnce([
        {
          lineId: 'line-1',
          date: '2026-05-25',
          amount: '150.00',
          description: 'STRIPE PAYOUT',
          reference: 'Ref-001',
          isReconciled: false,
        },
        {
          lineId: 'line-2',
          date: '2026-05-26',
          amount: '-50.00',
          description: 'UNKNOWN',
          reference: 'Ref-002',
          isReconciled: false,
        },
      ]);

      // 5. target account code
      dbMock.where.mockResolvedValueOnce([
        { code: '2000-TARGET', id: 'target-acc-1' },
      ]);

      // 6. bankJeLine query
      dbMock.where.mockResolvedValueOnce([
        {
          journalLineId: 'je-line-1',
          journalEntryId: '123',
          glAccountId: 'bank-acc-1',
        },
      ]);

      const csvData = Buffer.from(
        'Date,Amount,Description,Reference\n2026-05-25,150.00,STRIPE PAYOUT,Ref-001\n2026-05-26,-50.00,UNKNOWN,Ref-002',
      );
      const result = await service.importCsv(csvData, 'bank-acc-1', 'prof-1');

      expect(result.autoMatchedCount).toBe(1);
      expect(result.unmatchedCount).toBe(1);

      // Verify JE was created correctly for deposit
      expect(glServiceMock.postJournalEntry).toHaveBeenCalledWith(
        [
          {
            accountId: 'bank-acc-1',
            debit: 150,
            credit: 0,
            memo: 'STRIPE PAYOUT',
          },
          {
            accountId: 'target-acc-1',
            debit: 0,
            credit: 150,
            memo: 'STRIPE PAYOUT',
          },
        ],
        expect.objectContaining({
          sourceType: 'manual',
          memo: 'Auto-reconciled: STRIPE PAYOUT',
        }),
        dbMock,
      );

      // Verify updates
      expect(dbMock.update).toHaveBeenCalled();
    });

    it('should ignore rows with missing date or amount, and handle currency symbols', async () => {
      // 1. profile
      dbMock.where.mockResolvedValueOnce([
        {
          profileId: 'prof-1',
          headerRows: 1,
          dateColumn: '0',
          amountColumn: '1',
          descriptionColumn: '2',
        },
      ]);
      // 2. rules (importCsv)
      dbMock.orderBy.mockResolvedValueOnce([]); // No rules
      // 3. bank account (importCsv)
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // 4. rules (executeAutoMatching)
      dbMock.orderBy.mockResolvedValueOnce([]); // No rules
      // 5. bank account (executeAutoMatching)
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // Inside transaction: mock fetching lines
      dbMock.where.mockResolvedValueOnce([
        {
          lineId: 'line-3',
          date: '2026-05-25',
          amount: '1500.50',
          description: 'Valid',
          reference: '',
          isReconciled: false,
        },
      ]);

      // Row 1: valid with $ sign. Row 2: missing date. Row 3: missing amount.
      const csvData = Buffer.from(
        'Date,Amount,Description\n2026-05-25,"$1,500.50",Valid\n,100,MissingDate\n2026-05-26,MissingAmount,',
      );
      const result = await service.importCsv(csvData, 'bank-acc-1', 'prof-1');

      expect(result.autoMatchedCount).toBe(0);
      expect(result.unmatchedCount).toBe(1); // Only the valid row should be processed
    });

    it('should correctly parse debit and credit columns into negative and positive amounts', async () => {
      dbMock.where.mockResolvedValueOnce([
        {
          profileId: 'prof-2',
          headerRows: 1,
          dateColumn: '0',
          descriptionColumn: '1',
          debitColumn: '2',
          creditColumn: '3',
        },
      ]);
      dbMock.orderBy.mockResolvedValueOnce([]); // No rules
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      dbMock.orderBy.mockResolvedValueOnce([]); // No rules
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // Inside transaction
      dbMock.where.mockResolvedValueOnce([
        {
          lineId: 'l1',
          date: '2026-05-25',
          amount: '-50.00',
          description: 'Debit row',
          isReconciled: false,
        },
        {
          lineId: 'l2',
          date: '2026-05-26',
          amount: '100.00',
          description: 'Credit row',
          isReconciled: false,
        },
      ]);

      const csvData = Buffer.from(
        'Date,Desc,Debit,Credit\n2026-05-25,Debit row,50.00,\n2026-05-26,Credit row,,100.00',
      );
      const result = await service.importCsv(csvData, 'bank-acc-1', 'prof-2');

      expect(result.unmatchedCount).toBe(2);
      // The insert should have been called with correctly mapped amounts
      expect(dbMock.insert).toHaveBeenCalled();
    });
  });

  describe('executeAutoMatching', () => {
    beforeEach(() => {
      dbMock.select.mockReturnThis();
      dbMock.from.mockReturnThis();
      dbMock.where.mockReturnThis();
      dbMock.orderBy.mockReturnThis();
      dbMock.limit.mockReturnThis();
      dbMock.transaction.mockImplementation(
        async (cb: (tx: Record<string, jest.Mock>) => Promise<unknown>) => {
          return cb(dbMock);
        },
      );
    });

    const setupMocks = (
      rules: Record<string, unknown>[],
      lines: Record<string, unknown>[],
      settings: Record<string, unknown> = { bankMatchDateToleranceDays: 7 },
    ) => {
      jest
        .spyOn(service, 'getReconciliationRules')
        .mockResolvedValue(rules as never);
      dbMock.limit.mockResolvedValueOnce([settings]);
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);
      dbMock.where.mockResolvedValueOnce(lines);
      dbMock.where.mockImplementation(() => {
        return Promise.resolve([{ code: '2000-TARGET', id: 'target-acc-1' }]);
      });
      dbMock.innerJoin.mockReturnValue({
        where: jest.fn().mockResolvedValue([]),
      });
    };

    it('should ignore lines specified in ignoredStatementLineIds', async () => {
      setupMocks(
        [
          {
            ruleId: 'rule-1',
            conditionType: 'contains',
            conditionValue: 'FEE',
            targetGlAccountId: 'target',
          },
        ],
        [
          {
            lineId: 'line-1',
            description: 'BANK FEE',
            amount: '-10.00',
            date: '2026-05-01',
            isReconciled: false,
          },
          {
            lineId: 'line-2',
            description: 'MONTHLY FEE',
            amount: '-15.00',
            date: '2026-05-02',
            isReconciled: false,
          },
        ],
      );

      const result = await service.executeAutoMatching(
        'bank-acc-1',
        'system',
        undefined,
        true,
        ['line-1'],
      );
      expect(result.autoMatchedCount).toBe(1);
      expect(result.unmatchedCount).toBe(1); // line-1 is unmatched because it's ignored
      expect(result.proposedRuleMatches[0].bankLineId).toBe('line-2');
    });

    it('should match using starts_with and exact_match correctly', async () => {
      setupMocks(
        [
          {
            ruleId: 'rule-exact',
            conditionType: 'exact_match',
            conditionValue: 'EXACT FEE',
            targetGlAccountId: 'target',
          },
          {
            ruleId: 'rule-starts',
            conditionType: 'starts_with',
            conditionValue: 'START',
            targetGlAccountId: 'target',
          },
        ],
        [
          {
            lineId: 'line-1',
            description: 'EXACT FEE',
            amount: '-10',
            date: '2026-05-01',
            isReconciled: false,
          },
          {
            lineId: 'line-2',
            description: 'EXACT FEE EXTRA',
            amount: '-10',
            date: '2026-05-01',
            isReconciled: false,
          },
          {
            lineId: 'line-3',
            description: 'STARTING FEE',
            amount: '-10',
            date: '2026-05-01',
            isReconciled: false,
          },
          {
            lineId: 'line-4',
            description: 'NO START',
            amount: '-10',
            date: '2026-05-01',
            isReconciled: false,
          },
        ],
      );

      const result = await service.executeAutoMatching(
        'bank-acc',
        'system',
        undefined,
        true,
      );
      expect(result.autoMatchedCount).toBe(2);
      expect(result.unmatchedCount).toBe(2);
      const matchedIds = result.proposedRuleMatches.map((m) => m.bankLineId);
      expect(matchedIds).toContain('line-1');
      expect(matchedIds).toContain('line-3');
    });

    it('should match using typeCondition and payeeCondition correctly', async () => {
      setupMocks(
        [
          {
            ruleId: 'rule-type',
            conditionType: 'contains',
            conditionValue: 'FEE',
            typeCondition: 'FEE_TYPE',
            targetGlAccountId: 'target',
          },
          {
            ruleId: 'rule-payee',
            conditionType: 'contains',
            conditionValue: 'SUBSCRIPTION',
            payeeConditionType: 'exact_match',
            payeeConditionValue: 'Netflix',
            targetGlAccountId: 'target',
          },
        ],
        [
          {
            lineId: 'line-1',
            description: 'MONTHLY FEE',
            amount: '-10',
            date: '2026-05-01',
            type: 'FEE_TYPE',
            isReconciled: false,
          },
          {
            lineId: 'line-2',
            description: 'MONTHLY FEE',
            amount: '-10',
            date: '2026-05-01',
            type: 'OTHER_TYPE', // should not match rule-type
            isReconciled: false,
          },
          {
            lineId: 'line-3',
            description: 'NETFLIX SUBSCRIPTION',
            amount: '-15',
            date: '2026-05-01',
            payee: 'Netflix',
            isReconciled: false,
          },
        ],
      );

      const result = await service.executeAutoMatching(
        'bank-acc',
        'system',
        undefined,
        true,
      );
      expect(result.autoMatchedCount).toBe(2);
      expect(result.unmatchedCount).toBe(1);
      const matchedIds = result.proposedRuleMatches.map((m) => m.bankLineId);
      expect(matchedIds).toContain('line-1');
      expect(matchedIds).toContain('line-3');
    });

    it('should respect amountMin and amountMax in rules', async () => {
      setupMocks(
        [
          {
            ruleId: 'rule-range',
            conditionType: 'contains',
            conditionValue: 'FEE',
            amountMin: '-50',
            amountMax: '-10',
            targetGlAccountId: 'target',
          },
        ],
        [
          {
            lineId: 'line-1',
            description: 'FEE',
            amount: '-5.00',
            date: '2026-05-01',
          },
          {
            lineId: 'line-2',
            description: 'FEE',
            amount: '-20.00',
            date: '2026-05-01',
          },
          {
            lineId: 'line-3',
            description: 'FEE',
            amount: '-60.00',
            date: '2026-05-01',
          },
        ],
      );
      const result = await service.executeAutoMatching(
        'bank-acc',
        'system',
        undefined,
        true,
      );
      expect(result.autoMatchedCount).toBe(1);
      expect(result.proposedRuleMatches[0].bankLineId).toBe('line-2');
    });

    it('should respect glAccountId on rules', async () => {
      setupMocks(
        [
          {
            ruleId: 'rule-global',
            conditionType: 'contains',
            conditionValue: 'GLOBAL',
            glAccountIds: null,
            targetGlAccountId: 'target',
          },
          {
            ruleId: 'rule-specific',
            conditionType: 'contains',
            conditionValue: 'SPECIFIC',
            glAccountIds: ['other-bank'],
            targetGlAccountId: 'target',
          },
        ],
        [
          {
            lineId: 'line-1',
            description: 'GLOBAL FEE',
            amount: '-10',
            date: '2026-05-01',
          },
          {
            lineId: 'line-2',
            description: 'SPECIFIC FEE',
            amount: '-10',
            date: '2026-05-01',
          },
        ],
      );
      const result = await service.executeAutoMatching(
        'bank-acc',
        'system',
        undefined,
        true,
      );
      expect(result.autoMatchedCount).toBe(1);
      expect(result.proposedRuleMatches[0].bankLineId).toBe('line-1');
    });
  });
});
