import { CashFlowService } from './cash-flow.service';

describe('CashFlowService', () => {
  let service: CashFlowService;
  let mockDb: any;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
      execute: jest.fn(),
    };
    service = new CashFlowService(mockDb);
  });

  it('assembles complete cash flow statement data with fiscal period and certification', async () => {
    const periodRow = {
      periodId: 'p-100',
      periodName: '2026-08',
      fiscalYear: 2026,
      periodNumber: 8,
      startDate: '2026-08-01',
      endDate: '2026-08-31',
      status: 'hard_closed',
    };

    const orgRow = {
      name: 'HeroBM Australia',
      addressLine1: '200 George Street',
      city: 'Sydney',
      state: 'NSW',
      country: 'Australia',
      taxNumber: 'ABN 99 888 777 666',
      email: 'cfo@herobm.com',
      phone: '+61 2 9999 8888',
    };

    // 1. Period lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([periodRow]),
        }),
      }),
    });

    // 2. Org lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([orgRow]),
      }),
    });

    // 3. glSettings baseCurrency lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([{ baseCurrency: 'AUD' }]),
      }),
    });

    // 4. calculateCashFlowStatement queries (accounts, cash balances, journal activity)
    mockDb.execute
      .mockResolvedValueOnce([
        {
          glAccountId: 'acc-cash',
          accountCode: '1010',
          name: 'Operating Bank',
          accountType: 'Bank',
          isGroup: false,
        },
      ])
      .mockResolvedValueOnce([{ openingCash: '20000', closingCash: '35000' }])
      .mockResolvedValueOnce([]);

    const result = await service.assembleData(
      'p-100',
      { username: 'finance_lead' },
      {
        customPdfText: 'Certified Statutory Cash Flow Statement',
      },
    );

    expect(result.header.orgName).toBe('HeroBM Australia');
    expect(result.header.baseCurrency).toBe('AUD');
    expect(result.period.startDate).toBe('2026-08-01');
    expect(result.period.endDate).toBe('2026-08-31');
    expect(result.period.periodName).toBe('2026-08');
    expect(result.customPdfText).toBe(
      'Certified Statutory Cash Flow Statement',
    );
    expect(result.certification.snapshotHash).toHaveLength(16);
    expect(result.certification.preparedBy).toBe('finance_lead');
  });

  it('generates mock data with valid structure and zero drift', () => {
    const mock = service.generateMockData();
    expect(mock.header.orgName).toBeDefined();
    expect(mock.operatingActivities.lines.length).toBeGreaterThan(0);
    expect(mock.reconciliation.isReconciled).toBe(true);
    expect(mock.reconciliation.drift).toBe(0);
    expect(mock.certification.snapshotHash).toBeDefined();
  });

  it('returns a random period ID for preview rendering', async () => {
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        where: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue([{ id: 'hard-closed-id' }]),
        }),
      }),
    });

    const id = await service.getRandomId();
    expect(id).toBe('hard-closed-id');
  });
});
