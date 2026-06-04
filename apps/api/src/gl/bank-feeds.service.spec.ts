import { Test, TestingModule } from '@nestjs/testing';
import { BankFeedsService } from './bank-feeds.service';
import { GlService } from './gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('BankFeedsService', () => {
  let service: BankFeedsService;
  let dbMock: any;
  let glServiceMock: any;

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
      dbMock.transaction.mockImplementation(async (cb: any) => {
        return cb(dbMock);
      });
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
        'Date,Amount,Description\n2026-05-25,"$1,500.50",Valid\n,100,MissingDate\n2026-05-26,,MissingAmount',
      );
      const result = await service.importCsv(csvData, 'bank-acc-1', 'prof-1');

      expect(result.autoMatchedCount).toBe(0);
      expect(result.unmatchedCount).toBe(1); // Only the valid row should be processed
    });
  });
});
