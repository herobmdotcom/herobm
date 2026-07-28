import { Test, TestingModule } from '@nestjs/testing';
import { TaxBasService } from './tax-bas.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  glSettings,
  glJournalLines,
  glJournalEntries,
} from '../drizzle/schema';

describe('TaxBasService', () => {
  let service: TaxBasService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      query: {
        glSettings: {
          findFirst: jest.fn().mockResolvedValue({
            defaultTaxAccountId: 'tax-id',
            defaultRevenueAccountId: 'rev-id',
          }),
        },
      },
      select: jest.fn().mockReturnThis(),
      from: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest
        .fn()
        .mockResolvedValue([{ totalCredit: '1000.49', totalDebit: '200.51' }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxBasService,
        {
          provide: DRIZZLE,
          useValue: mockDb,
        },
      ],
    }).compile();

    service = module.get<TaxBasService>(TaxBasService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate BAS summary with correct rounding', async () => {
    const result = await service.getBasSummary({});
    expect(result).toBeDefined();

    // Test data: Tax Credit = 1000.49, Tax Debit = 200.51
    // Revenue Credit = 1000.49, Revenue Debit = 200.51
    // GST on Sales (1A) = Math.round(1000.49) = 1000
    // GST on Purchases (1B) = Math.round(200.51) = 201
    // Revenue Net = 1000.49 - 200.51 = 799.98
    // Total Sales (G1) = Math.round(799.98 + 1000.49) = 1800

    expect(result.find((r) => r.id === '1A')?.amount).toBe(1000);
    expect(result.find((r) => r.id === '1B')?.amount).toBe(201);
    expect(result.find((r) => r.id === 'G1')?.amount).toBe(1800);

    // W1, W2 = 0
    expect(result.find((r) => r.id === 'W1')?.amount).toBe(0);
    expect(result.find((r) => r.id === 'W2')?.amount).toBe(0);

    // 8A = 1000 + 0 = 1000
    expect(result.find((r) => r.id === '8A')?.amount).toBe(1000);
    // 8B = 201
    expect(result.find((r) => r.id === '8B')?.amount).toBe(201);
    // 9 = |1000 - 201| = 799
    expect(result.find((r) => r.id === '9')?.amount).toBe(799);
  });
});
