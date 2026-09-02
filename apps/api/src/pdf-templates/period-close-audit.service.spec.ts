import { PeriodCloseAuditService } from './period-close-audit.service';
import { NotFoundException } from '@nestjs/common';

describe('PeriodCloseAuditService', () => {
  let service: PeriodCloseAuditService;
  let mockDb: any;
  let mockGlService: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    mockGlService = {
      getTrialBalance: jest.fn(),
    };
    service = new PeriodCloseAuditService(mockDb, mockGlService);
  });

  it('should throw NotFoundException if fiscal period does not exist', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([]),
        }),
      }),
    });

    await expect(
      service.assembleData('non-existent-period-id'),
    ).rejects.toThrow(NotFoundException);
  });

  it('should assemble period close audit snapshot with categorized trial balance and integrity checks', async () => {
    const periodRow = {
      periodId: 'p-1',
      periodName: '2026-08',
      fiscalYear: 2026,
      periodNumber: 8,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'hard_closed',
      lockedBy: 'controller@herobm.com',
      lockedAt: new Date('2026-08-31T18:00:00Z'),
      closedBy: 'cfo@herobm.com',
      closedAt: new Date('2026-08-31T23:59:59Z'),
      notes: 'Period closed and certified',
    };

    const orgRow = {
      name: 'HeroBM Manufacturing Corp',
      addressLine1: '100 Industrial Parkway',
      city: 'Sydney',
      state: 'NSW',
      country: 'Australia',
      taxNumber: 'ABN 12 345 678 901',
      email: 'audit@herobm.com',
      phone: '+61 2 9000 0000',
    };

    const glSettingsRow = {
      baseCurrency: 'AUD',
      defaultArAccountId: '00000000-0000-0000-0000-000000000001',
      defaultApAccountId: '00000000-0000-0000-0000-000000000002',
      defaultGrniAccountId: '00000000-0000-0000-0000-000000000003',
      defaultInventoryAccountId: '00000000-0000-0000-0000-000000000004',
    };

    const trialBalanceRows = [
      {
        accountCode: '1000',
        name: 'Operating Bank Account',
        accountType: 'asset',
        isGroup: false,
        openingBalance: 50000,
        periodDebit: 20000,
        periodCredit: 10000,
        closingBalance: 60000,
        ytdDebit: 80000,
        ytdCredit: 20000,
        ytdBalance: 60000,
      },
      {
        accountCode: '1200',
        name: 'Accounts Receivable Control',
        accountType: 'asset',
        isGroup: false,
        openingBalance: 30000,
        periodDebit: 15000,
        periodCredit: 10000,
        closingBalance: 35000,
        ytdDebit: 60000,
        ytdCredit: 25000,
        ytdBalance: 35000,
      },
      {
        accountCode: '2000',
        name: 'Accounts Payable Control',
        accountType: 'liability',
        isGroup: false,
        openingBalance: -20000,
        periodDebit: 10000,
        periodCredit: 15000,
        closingBalance: -25000,
        ytdDebit: 30000,
        ytdCredit: 55000,
        ytdBalance: -25000,
      },
      {
        accountCode: '3000',
        name: 'Share Capital',
        accountType: 'equity',
        isGroup: false,
        openingBalance: -50000,
        periodDebit: 0,
        periodCredit: 0,
        closingBalance: -50000,
        ytdDebit: 0,
        ytdCredit: 0,
        ytdBalance: -50000,
      },
      {
        accountCode: '4000',
        name: 'Trading Revenue',
        accountType: 'revenue',
        isGroup: false,
        openingBalance: 0,
        periodDebit: 0,
        periodCredit: 40000,
        closingBalance: -40000,
        ytdDebit: 0,
        ytdCredit: 120000,
        ytdBalance: -120000,
      },
      {
        accountCode: '5000',
        name: 'Cost of Goods Sold',
        accountType: 'expense',
        isGroup: false,
        openingBalance: 0,
        periodDebit: 20000,
        periodCredit: 0,
        closingBalance: 20000,
        ytdDebit: 60000,
        ytdCredit: 0,
        ytdBalance: 60000,
      },
    ];

    const timelineEvents = [
      {
        eventType: 'created',
        entityDisplayName: '2026-08',
        createdOn: new Date('2026-08-01T00:00:00Z'),
        actor: 'system',
        payload: { notes: 'Auto-generated period' },
      },
      {
        eventType: 'status_changed',
        entityDisplayName: '2026-08',
        createdOn: new Date('2026-08-31T23:59:59Z'),
        actor: 'cfo@herobm.com',
        payload: { notes: 'Period hard-closed' },
      },
    ];

    // 1. Mock fiscal period select
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([periodRow]),
        }),
      }),
    });

    // 2. Mock organization select
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([orgRow]),
      }),
    });

    // 3. Mock glSettings select for baseCurrency
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ baseCurrency: 'AUD' }]),
      }),
    });

    // 4. Mock glService.getTrialBalance
    mockGlService.getTrialBalance.mockResolvedValue(trialBalanceRows);

    // 5. Mock reconciliation queries in calculateSubledgerReconciliation
    // glSettings in recon util
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([glSettingsRow]),
      }),
    });
    // ar account
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([{ accountCode: '1200', name: 'AR' }]),
        }),
      }),
    });
    // ap account
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([{ accountCode: '2000', name: 'AP' }]),
        }),
      }),
    });
    // grni account
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([{ accountCode: '2150', name: 'GRNI' }]),
        }),
      }),
    });
    // inv account
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([{ accountCode: '1300', name: 'Inventory' }]),
        }),
      }),
    });

    // execScalar queries in calculateSubledgerReconciliation:
    // 1: tbDebit, 2: tbCredit, 3: arSubledger, 4: arGl, 5: apSubledger, 6: apGl, 7: grniSubledger, 8: grniGl, 9: invSubledger, 10: invGl
    mockDb.execute = jest
      .fn()
      .mockResolvedValueOnce([{ val: 45000 }]) // tbDebit
      .mockResolvedValueOnce([{ val: 45000 }]) // tbCredit
      .mockResolvedValueOnce([{ val: 35000 }]) // arSubledger
      .mockResolvedValueOnce([{ val: 35000 }]) // arGl
      .mockResolvedValueOnce([{ val: 25000 }]) // apSubledger
      .mockResolvedValueOnce([{ val: 25000 }]) // apGl
      .mockResolvedValueOnce([{ val: 0 }]) // grniSubledger
      .mockResolvedValueOnce([{ val: 0 }]) // grniGl
      .mockResolvedValueOnce([{ val: 0 }]) // invSubledger
      .mockResolvedValueOnce([{ val: 0 }]); // invGl

    // 6. Mock financialEvents select
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          orderBy: jest.fn().mockResolvedValue(timelineEvents),
        }),
      }),
    });

    const result = await service.assembleData(
      'p-1',
      { username: 'auditor1' },
      {
        customPdfText: 'Certified board pack snapshot.',
      },
    );

    expect(result.header.orgName).toBe('HeroBM Manufacturing Corp');
    expect(result.header.baseCurrency).toBe('AUD');
    expect(result.period.periodName).toBe('2026-08');
    expect(result.period.status).toBe('hard_closed');
    expect(result.period.closedBy).toBe('cfo@herobm.com');
    expect(result.subledgerIntegrity.isOverallBalanced).toBe(true);
    expect(result.subledgerIntegrity.trialBalanceZeroSum.isBalanced).toBe(true);
    expect(result.trialBalance.categories.length).toBeGreaterThan(0);
    expect(result.certification.snapshotHash).toHaveLength(16);
    expect(result.certification.preparedBy).toBe('cfo@herobm.com');
    expect(result.customPdfText).toBe('Certified board pack snapshot.');
    expect(result.timeline.length).toBe(2);
  });

  it('should generate mock data with valid structure', () => {
    const mock = service.generateMockData();
    expect(mock.header.orgName).toBeDefined();
    expect(mock.period.periodName).toBe('2026-08');
    expect(mock.executiveSummary.isBalanceSheetBalanced).toBe(true);
    expect(mock.subledgerIntegrity.isOverallBalanced).toBe(true);
    expect(mock.trialBalance.categories.length).toBeGreaterThan(0);
    expect(mock.certification.snapshotHash).toBeDefined();
  });

  it('should return random ID for preview', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest
            .fn()
            .mockResolvedValue([{ id: 'hard-closed-period-uuid' }]),
        }),
      }),
    });

    const id = await service.getRandomId();
    expect(id).toBe('hard-closed-period-uuid');
  });
});
