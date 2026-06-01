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
      returning: jest.fn().mockResolvedValue([{}]),
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
      // Mock fetching mapping profile
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

      // Mock fetching rules (STRIPE PAYOUT to target account 999)
      dbMock.orderBy.mockResolvedValueOnce([
        {
          ruleId: 'rule-1',
          conditionType: 'contains',
          conditionValue: 'STRIPE',
          targetGlAccountId: 'target-acc-1',
        },
      ]);

      // Mock fetching Bank Account code
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // Inside transaction: mock fetching Target Account code
      dbMock.where.mockResolvedValueOnce([{ code: '2000-TARGET' }]);

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
            accountCode: '1000-BANK',
            debit: 150,
            credit: 0,
            memo: 'STRIPE PAYOUT',
          },
          {
            accountCode: '2000-TARGET',
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

      // Verify that matched and unmatched lines were queued accordingly
      expect(dbMock.insert).toHaveBeenCalledTimes(2); // One for reconciled, one for pending
      expect(dbMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'STRIPE PAYOUT',
          isReconciled: true,
        }),
      );
      expect(dbMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          description: 'UNKNOWN',
          isReconciled: false,
        }),
      );
    });

    it('should ignore rows with missing date or amount, and handle currency symbols', async () => {
      dbMock.where.mockResolvedValueOnce([
        {
          profileId: 'prof-1',
          headerRows: 1,
          dateColumn: '0',
          amountColumn: '1',
          descriptionColumn: '2',
        },
      ]);
      dbMock.orderBy.mockResolvedValueOnce([]); // No rules
      dbMock.where.mockResolvedValueOnce([{ code: '1000-BANK' }]);

      // Row 1: valid with $ sign. Row 2: missing date. Row 3: missing amount.
      const csvData = Buffer.from(
        'Date,Amount,Description\n2026-05-25,"$1,500.50",Valid\n,100,MissingDate\n2026-05-26,,MissingAmount',
      );
      const result = await service.importCsv(csvData, 'bank-acc-1', 'prof-1');

      expect(result.autoMatchedCount).toBe(0);
      expect(result.unmatchedCount).toBe(1); // Only the valid row should be processed

      expect(dbMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: '1500.5',
          description: 'Valid',
        }),
      );
    });
  });
});
