import { Test, TestingModule } from '@nestjs/testing';
import { CoaLoaderService } from './coa-loader.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Unit tests for the COA Loader Service.
 *
 * Coverage targets:
 * - loadFromFile: skip when accounts exist, file not found, JSON parsing
 * - Tree walker: root_type mapping, is_group detection, auto-numbering,
 *                inheritance of accountType, parent-child relationships
 * - Transaction: insert order, parent linking, settings creation
 */

// ---------------------------------------------------------------------------
// Mock factory
// ---------------------------------------------------------------------------

function createMockDb() {
  let insertCalls: any[] = [];
  let updateCalls: any[] = [];

  const mockTx: any = {
    insert: jest.fn().mockImplementation((table: any) => {
      const call = { table, values: null as any };
      insertCalls.push(call);
      return {
        values: jest.fn().mockImplementation((vals: any) => {
          call.values = vals;
          return {
            returning: jest.fn().mockResolvedValue([{
              glAccountId: `gen-${insertCalls.length}`,
              accountCode: vals.accountCode || 'code',
              name: vals.name || 'name',
            }]),
          };
        }),
      };
    }),
    update: jest.fn().mockImplementation(() => ({
      set: jest.fn().mockReturnValue({
        where: jest.fn().mockResolvedValue(undefined),
      }),
    })),
  };

  let countResult = 0;

  const mockDb: any = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(
        Promise.resolve([{ count: countResult }]),
      ),
    }),
    transaction: jest.fn().mockImplementation(async (fn: any) => fn(mockTx)),
  };

  return {
    db: mockDb,
    tx: mockTx,
    insertCalls,
    setExistingCount: (n: number) => {
      countResult = n;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockResolvedValue([{ count: n }]),
      });
    },
  };
}

describe('CoaLoaderService', () => {
  let service: CoaLoaderService;
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mock = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CoaLoaderService,
        { provide: DRIZZLE, useValue: mock.db },
      ],
    }).compile();

    service = module.get<CoaLoaderService>(CoaLoaderService);
  });

  // =========================================================================
  // Skip when accounts already exist
  // =========================================================================

  describe('loadFromFile — skip logic', () => {
    it('should skip loading when accounts already exist', async () => {
      mock.setExistingCount(5);
      const result = await service.loadFromFile('au_standard.json');
      expect(result.skipped).toBe(true);
      expect(result.created).toBe(0);
      expect(mock.db.transaction).not.toHaveBeenCalled();
    });

    it('should skip even with count=1', async () => {
      mock.setExistingCount(1);
      const result = await service.loadFromFile('au_standard.json');
      expect(result.skipped).toBe(true);
    });
  });

  // =========================================================================
  // File not found
  // =========================================================================

  describe('loadFromFile — file errors', () => {
    it('should throw when COA file does not exist', async () => {
      mock.setExistingCount(0);
      await expect(
        service.loadFromFile('nonexistent_chart.json'),
      ).rejects.toThrow('COA file not found');
    });
  });

  // =========================================================================
  // JSON Parsing — ERPNext format
  // =========================================================================

  describe('loadFromFile — ERPNext JSON parsing', () => {
    let tempDir: string;
    let tempFile: string;

    beforeEach(() => {
      // Create a temp chart file that the loader can find via __dirname
      tempDir = path.join(__dirname, 'charts');
      tempFile = path.join(tempDir, '_test_chart.json');
    });

    afterEach(() => {
      // Clean up temp file
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    });

    it('should parse a minimal ERPNext COA with root_type mapping', async () => {
      mock.setExistingCount(0);
      const chart = {
        name: 'Test Chart',
        tree: {
          Assets: {
            root_type: 'Asset',
            is_group: 1,
            children: {
              'Cash': { account_number: '1010', account_type: 'Cash' },
            },
          },
          Revenue: {
            root_type: 'Income',
            is_group: 1,
            children: {
              'Sales': { account_number: '4100' },
            },
          },
        },
      };

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(tempFile, JSON.stringify(chart));

      const result = await service.loadFromFile('_test_chart.json');

      expect(result.skipped).toBe(false);
      expect(result.created).toBe(4); // Assets (group), Cash, Revenue (group), Sales

      // Verify insert calls
      const insertedValues = mock.insertCalls.map(c => c.values);

      // Assets group
      expect(insertedValues[0]).toMatchObject({
        accountCode: expect.any(String), // auto-numbered since Assets has no account_number
        name: 'Assets',
        accountType: 'asset',
        isGroup: true,
        isSystem: true,
      });

      // Cash
      expect(insertedValues[1]).toMatchObject({
        accountCode: '1010',
        name: 'Cash',
        accountType: 'asset', // Inherited from parent
        isGroup: false,
      });

      // Revenue group — note Income maps to 'revenue'
      expect(insertedValues[2]).toMatchObject({
        name: 'Revenue',
        accountType: 'revenue',
        isGroup: true,
      });
    });

    it('should auto-number accounts without account_number', async () => {
      mock.setExistingCount(0);
      const chart = {
        name: 'No Numbers',
        tree: {
          Misc: {
            root_type: 'Expense',
          },
        },
      };

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(tempFile, JSON.stringify(chart));

      const result = await service.loadFromFile('_test_chart.json');

      expect(result.created).toBe(1);
      const code = mock.insertCalls[0].values.accountCode;
      expect(code).toMatch(/^\d+$/); // Auto-generated number
    });

    it('should detect is_group from children presence', async () => {
      mock.setExistingCount(0);
      const chart = {
        name: 'Auto Group',
        tree: {
          Parent: {
            root_type: 'Asset',
            // No is_group flag, but has children — should be detected as group
            children: {
              Child: { account_number: '1001' },
            },
          },
        },
      };

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(tempFile, JSON.stringify(chart));

      await service.loadFromFile('_test_chart.json');

      expect(mock.insertCalls[0].values.isGroup).toBe(true);
      expect(mock.insertCalls[1].values.isGroup).toBe(false);
    });

    it('should inherit accountType from parent when node lacks root_type', async () => {
      mock.setExistingCount(0);
      const chart = {
        name: 'Inheritance',
        tree: {
          Expenses: {
            root_type: 'Expense',
            is_group: 1,
            children: {
              'Operating': {
                is_group: 1,
                account_number: '6000',
                children: {
                  'Wages': { account_number: '6100' },
                },
              },
            },
          },
        },
      };

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(tempFile, JSON.stringify(chart));

      await service.loadFromFile('_test_chart.json');

      // 'Wages' should inherit 'expense' from root Expenses
      const wagesInsert = mock.insertCalls.find(c => c.values.name === 'Wages');
      expect(wagesInsert!.values.accountType).toBe('expense');
    });

    it('should create GL settings with default account mappings', async () => {
      mock.setExistingCount(0);
      const chart = {
        name: 'With Defaults',
        tree: {
          Assets: {
            root_type: 'Asset',
            children: {
              AR: { account_number: '1100', account_type: 'Receivable' },
            },
          },
        },
        default_accounts: {
          receivable: '1100',
          payable: '2100',
        },
      };

      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
      fs.writeFileSync(tempFile, JSON.stringify(chart));

      await service.loadFromFile('_test_chart.json');

      // Should have 3 inserts: Assets (group), AR (leaf), gl_settings
      // The settings insert is the last one
      const settingsInsert = mock.insertCalls[mock.insertCalls.length - 1];
      expect(settingsInsert.values.fiscalYearStartMonth).toBe(7);
      expect(settingsInsert.values.baseCurrency).toBe('AUD');
    });
  });

  // =========================================================================
  // Real au_standard.json
  // =========================================================================

  describe('loadFromFile — au_standard.json (real file)', () => {
    it('should successfully parse the real AU COA file', async () => {
      mock.setExistingCount(0);
      const result = await service.loadFromFile('au_standard.json');

      expect(result.skipped).toBe(false);
      expect(result.created).toBeGreaterThan(25); // ~30 accounts
      expect(result.created).toBeLessThan(50); // Sanity cap
    });

    it('should create accounts for all 5 root types', async () => {
      mock.setExistingCount(0);
      await service.loadFromFile('au_standard.json');

      const types = new Set(mock.insertCalls.map(c => c.values.accountType));
      expect(types).toContain('asset');
      expect(types).toContain('liability');
      expect(types).toContain('equity');
      expect(types).toContain('revenue');
      expect(types).toContain('expense');
    });

    it('should include expected core accounts', async () => {
      mock.setExistingCount(0);
      await service.loadFromFile('au_standard.json');

      const names = mock.insertCalls.map(c => c.values.name);
      expect(names).toContain('Accounts Receivable');
      expect(names).toContain('Accounts Payable');
      expect(names).toContain('Sales Revenue');
      expect(names).toContain('GST Payable');
      expect(names).toContain('GST Receivable');
    });

    it('should mark all seed accounts as system accounts', async () => {
      mock.setExistingCount(0);
      await service.loadFromFile('au_standard.json');

      // All accounts except gl_settings should be isSystem: true
      const accountInserts = mock.insertCalls.filter(c => c.values.isSystem !== undefined);
      for (const insert of accountInserts) {
        expect(insert.values.isSystem).toBe(true);
      }
    });
  });
});
