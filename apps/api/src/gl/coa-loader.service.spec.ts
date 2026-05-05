import { Test, TestingModule } from '@nestjs/testing';
import { CoaLoaderService } from './coa-loader.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import * as fs from 'fs';
import * as path from 'path';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { glAccounts, glSettings } from '../drizzle/modbm-core-schema';
import { count, eq } from 'drizzle-orm';

describe('CoaLoaderService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: CoaLoaderService;

  beforeEach(async () => {
    // Clean tables for isolation
    await pg.db.delete(glAccounts);
    await pg.db.delete(glSettings);

    const module: TestingModule = await Test.createTestingModule({
      providers: [CoaLoaderService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<CoaLoaderService>(CoaLoaderService);
  });

  describe('loadFromFile — existing accounts logic', () => {
    it('should proceed even if accounts already exist', async () => {
      // Seed one account
      await pg.db.insert(glAccounts).values({
        accountCode: 'EXISTING',
        name: 'Existing',
        accountType: 'asset',
        isActive: true,
        currencyCode: 'AUD',
      });

      const result = await service.loadFromFile('au_standard.json');
      expect(result.skipped).toBe(false);
      expect(result.created).toBeGreaterThan(0);
    });
  });

  describe('loadFromFile — file errors', () => {
    it('should throw when COA file does not exist', async () => {
      await expect(
        service.loadFromFile('nonexistent_chart.json'),
      ).rejects.toThrow('COA file not found');
    });
  });

  describe('loadFromFile — ERPNext JSON parsing', () => {
    let tempDir: string;
    let tempFile: string;

    beforeEach(() => {
      tempDir = path.join(__dirname, 'charts');
      tempFile = path.join(tempDir, '_test_chart.json');
      if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    });

    afterEach(() => {
      if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
    });

    it('should parse a minimal ERPNext COA with root_type mapping', async () => {
      const chart = {
        name: 'Test Chart',
        tree: {
          Assets: {
            root_type: 'Asset',
            is_group: 1,
            children: {
              Cash: { account_number: '1010', account_type: 'Cash' },
            },
          },
          Revenue: {
            root_type: 'Income',
            is_group: 1,
            children: {
              Sales: { account_number: '4100' },
            },
          },
        },
      };

      fs.writeFileSync(tempFile, JSON.stringify(chart));
      const result = await service.loadFromFile('_test_chart.json');

      expect(result.created).toBe(4); // Assets, Cash, Revenue, Sales

      const accounts = await pg.db
        .select()
        .from(glAccounts)
        .orderBy(glAccounts.accountCode);

      const assets = accounts.find((a) => a.name === 'Assets');
      const cash = accounts.find((a) => a.name === 'Cash');
      const revenue = accounts.find((a) => a.name === 'Revenue');

      expect(assets).toMatchObject({ isGroup: true, accountType: 'asset' });
      expect(cash).toMatchObject({ accountCode: '1010', accountType: 'asset' });
      expect(revenue).toMatchObject({ accountType: 'revenue' });
    });

    it('should create GL settings with default account mappings', async () => {
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
        },
      };

      fs.writeFileSync(tempFile, JSON.stringify(chart));
      await service.loadFromFile('_test_chart.json');

      const [settings] = await pg.db.select().from(glSettings);
      expect(settings).toBeDefined();
      expect(settings.baseCurrency).toBe('AUD');

      const [ar] = await pg.db
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.accountCode, '1100'));
      expect(settings.defaultArAccountId).toBe(ar.glAccountId);
    });
  });

  describe('loadFromFile — au_standard.json (real file)', () => {
    it('should successfully parse the real AU COA file', async () => {
      const result = await service.loadFromFile('au_standard.json');
      expect(result.created).toBeGreaterThan(25);

      const [accCount] = await pg.db.select({ val: count() }).from(glAccounts);
      expect(accCount.val).toBe(result.created);
    });
  });
});
