import { Test, TestingModule } from '@nestjs/testing';
import { TaxReportsService } from './tax-reports.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { taxCategories } from '@herobm/db-schema';

describe('TaxReportsService', () => {
  let service: TaxReportsService;
  let mockDb: any;
  let callCount: number;

  beforeEach(async () => {
    callCount = 0;
    mockDb = {
      query: {
        glSettings: {
          findFirst: jest.fn().mockResolvedValue({
            defaultSalesTaxAccountId: 'sales-tax-acct-1',
            defaultPurchaseTaxAccountId: 'purch-tax-acct-1',
            defaultRevenueAccountId: 'rev-acct-1',
            defaultExpenseAccountId: 'exp-acct-1',
          }),
        },
      },
      select: jest.fn().mockImplementation(() => {
        callCount++;
        const currentCall = callCount;
        return {
          from: jest.fn().mockImplementation((table) => {
            if (table === taxCategories) {
              return Promise.resolve([
                {
                  taxCategoryId: 'cat-10',
                  code: 'GST_10',
                  title: 'GST Standard 10%',
                  type: 'tax_applies',
                  rate: '10',
                  salesGlAccountId: 'sales-tax-acct-1',
                  purchaseGlAccountId: 'purch-tax-acct-1',
                },
              ]);
            }
            return {
              innerJoin: jest.fn().mockReturnValue({
                where: jest.fn().mockImplementation(() => {
                  // Call 2: sales tax, Call 3: purchase tax, Call 4: revenue, Call 5: expense
                  if (currentCall === 2) {
                    return {
                      groupBy: jest.fn().mockResolvedValue([
                        {
                          glAccountId: 'sales-tax-acct-1',
                          totalCredit: '1000.49',
                          totalDebit: '0',
                        },
                      ]),
                    };
                  }
                  if (currentCall === 3) {
                    return {
                      groupBy: jest.fn().mockResolvedValue([
                        {
                          glAccountId: 'purch-tax-acct-1',
                          totalCredit: '0',
                          totalDebit: '200.51',
                        },
                      ]),
                    };
                  }
                  if (currentCall === 4) {
                    // Revenue
                    return Promise.resolve([
                      { totalCredit: '10000.00', totalDebit: '2000.00' },
                    ]);
                  }
                  // Expense
                  return Promise.resolve([
                    { totalCredit: '500.00', totalDebit: '4500.00' },
                  ]);
                }),
              }),
            };
          }),
        };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxReportsService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TaxReportsService>(TaxReportsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate generic tax summary metrics correctly', async () => {
    const report = await service.getTaxReport({ reportType: 'generic' });
    expect(report).toBeDefined();
    expect(report.reportType).toBe('generic');
    expect(report.title).toBe('Generic Tax Summary');
    expect(report.genericSummary).toBeDefined();

    expect(report.genericSummary.totalOutputTax).toBe(1000.49);
    expect(report.genericSummary.totalInputTax).toBe(200.51);
    expect(report.genericSummary.netTaxLiability).toBe(799.98);
    expect(report.genericSummary.netStatus).toBe('payable');
    expect(report.genericSummary.totalNetSales).toBe(8000);
    expect(report.genericSummary.totalGrossSales).toBe(9000.49);
    expect(report.genericSummary.categories.length).toBe(1);
    expect(report.genericSummary.categories[0].code).toBe('GST_10');
  });

  it('should format Australian ATO BAS boxes correctly', async () => {
    const report = await service.getTaxReport({ reportType: 'au_bas' });
    expect(report.reportType).toBe('au_bas');
    expect(report.title).toBe('ATO BAS Report');
    expect(report.boxes).toBeDefined();

    const g1 = report.boxes?.find((b) => b.id === 'G1');
    const b1a = report.boxes?.find((b) => b.id === '1A');
    const b1b = report.boxes?.find((b) => b.id === '1B');
    const b8a = report.boxes?.find((b) => b.id === '8A');
    const b8b = report.boxes?.find((b) => b.id === '8B');
    const b9 = report.boxes?.find((b) => b.id === '9');

    expect(g1?.amount).toBe(9000);
    expect(b1a?.amount).toBe(1000);
    expect(b1b?.amount).toBe(201);
    expect(b8a?.amount).toBe(1000);
    expect(b8b?.amount).toBe(201);
    expect(b9?.amount).toBe(799);
  });

  it('should format UK HMRC VAT return boxes correctly', async () => {
    const report = await service.getTaxReport({ reportType: 'uk_vat' });
    expect(report.reportType).toBe('uk_vat');
    expect(report.title).toBe('HMRC VAT Return');
    expect(report.boxes).toBeDefined();

    const box1 = report.boxes?.find((b) => b.id === 'BOX_1');
    const box4 = report.boxes?.find((b) => b.id === 'BOX_4');
    const box5 = report.boxes?.find((b) => b.id === 'BOX_5');

    expect(box1?.amount).toBe(1000.49);
    expect(box4?.amount).toBe(200.51);
    expect(box5?.amount).toBe(799.98);
  });

  it('should format Singapore IRAS GST Form 5 boxes correctly', async () => {
    const report = await service.getTaxReport({ reportType: 'sg_gst' });
    expect(report.reportType).toBe('sg_gst');
    expect(report.title).toBe('IRAS GST Return');
    expect(report.boxes).toBeDefined();

    const box6 = report.boxes?.find((b) => b.id === 'BOX_6');
    const box7 = report.boxes?.find((b) => b.id === 'BOX_7');
    const box8 = report.boxes?.find((b) => b.id === 'BOX_8');

    expect(box6?.amount).toBe(1000);
    expect(box7?.amount).toBe(201);
    expect(box8?.amount).toBe(799);
  });

  it('should format Germany USt-VA lines correctly', async () => {
    const report = await service.getTaxReport({ reportType: 'de_ustva' });
    expect(report.reportType).toBe('de_ustva');
    expect(report.title).toBe('Umsatzsteuer-Voranmeldung (USt-VA)');
    expect(report.boxes).toBeDefined();

    const zg66 = report.boxes?.find((b) => b.id === 'ZG_66');
    const zg83 = report.boxes?.find((b) => b.id === 'ZG_83');

    expect(zg66?.amount).toBe(201);
    expect(zg83?.amount).toBe(799);
  });

  it('should format US Sales & Use Tax summary lines correctly', async () => {
    const report = await service.getTaxReport({ reportType: 'us_sales_tax' });
    expect(report.reportType).toBe('us_sales_tax');
    expect(report.title).toBe('Sales & Use Tax Summary');
    expect(report.boxes).toBeDefined();

    const taxCollected = report.boxes?.find((b) => b.id === 'TAX_COLLECTED');
    expect(taxCollected?.amount).toBe(1000);
  });
});
