import { AccountingCodesService } from './accounting-codes.service';
import { GlService } from './gl.service';

describe('AccountingCodesService', () => {
  let service: AccountingCodesService;
  let mockDb: any;
  let mockGlService: Partial<GlService>;

  beforeEach(() => {
    mockDb = {
      select: jest.fn(),
    };
    mockGlService = {
      getChartOfAccounts: jest.fn().mockResolvedValue([
        {
          accountCode: '1000',
          name: 'Assets',
          accountType: 'asset',
          isGroup: true,
          children: [
            {
              accountCode: '1010',
              name: 'Operating Cash',
              accountType: 'asset',
              isGroup: false,
              children: [],
            },
          ],
        },
      ]),
    };
    service = new AccountingCodesService(mockDb, mockGlService as GlService);
  });

  it('assembles complete accounting codes report data with tree flattening', async () => {
    const orgRow = {
      name: 'HeroBM Australia Pty Ltd',
      addressLine1: '200 George Street',
      city: 'Sydney',
      state: 'NSW',
      postCode: '2000',
      country: 'Australia',
      taxNumber: 'ABN 99 888 777 666',
      email: 'finance@herobm.com',
      phone: '+61 2 9999 8888',
    };

    const settingsRow = {
      baseCurrency: 'AUD',
    };

    const costCenterRows = [
      { code: '00', name: 'General', isActive: true },
      { code: '10', name: 'Ops', isActive: false },
    ];

    const activityRows = [
      { code: '00', name: 'Standard', isActive: true },
      { code: '01', name: 'Delivery', isActive: true },
    ];

    // 1. Org lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([orgRow]),
      }),
    });

    // 2. Settings lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue([settingsRow]),
      }),
    });

    // 3. Cost Centers lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(costCenterRows),
      }),
    });

    // 4. Activities lookup
    mockDb.select.mockReturnValueOnce({
      from: jest.fn().mockReturnValue({
        orderBy: jest.fn().mockResolvedValue(activityRows),
      }),
    });

    const result = await service.assembleData(
      'default',
      { role: 'admin' },
      { customPdfText: 'Confidential' },
    );

    expect(result.header.orgName).toBe('HeroBM Australia Pty Ltd');
    expect(result.header.baseCurrency).toBe('AUD');
    expect(result.header.orgTaxId).toBe('ABN 99 888 777 666');
    expect(result.customPdfText).toBe('Confidential');

    // Verify COA flattening and depths
    expect(result.coa).toHaveLength(2);
    expect(result.coa[0]).toEqual({
      accountCode: '1000',
      name: 'Assets',
      accountType: 'asset',
      isGroup: true,
      depth: 0,
    });
    expect(result.coa[1]).toEqual({
      accountCode: '1010',
      name: 'Operating Cash',
      accountType: 'asset',
      isGroup: false,
      depth: 1,
    });

    // Verify Cost Centers & Activities
    expect(result.costCenters).toEqual(costCenterRows);
    expect(result.activities).toEqual(activityRows);
    expect(result.generatedAt).toBeDefined();
  });

  it('generates fallback mock data properly', () => {
    const mock = service.generateMockData();
    expect(mock.header.orgName).toBeDefined();
    expect(mock.coa.length).toBeGreaterThan(0);
    expect(mock.costCenters.length).toBeGreaterThan(0);
    expect(mock.activities.length).toBeGreaterThan(0);
  });

  it('returns default id', async () => {
    const id = await service.getRandomId();
    expect(id).toBe('default');
  });
});
