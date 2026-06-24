import { Test, TestingModule } from '@nestjs/testing';
import { GlController } from './gl.controller';
import { GlService } from './gl.service';
import { CoaLoaderService } from './coa-loader.service';
import { FxRevaluationService } from './fx-revaluation.service';
import { AppConfigService } from '../settings/app-config.service';
import { GLAccountType } from '@herobm/shared';
import { JwtUser } from '../auth/auth-user.decorator';

/**
 * Unit tests for the GL Controller.
 *
 * Coverage targets:
 * - All 9 endpoints delegate to correct service method with correct args
 * - Query parameter parsing (format, limit, dates)
 * - Manual JE translates body to JournalMeta correctly
 * - Seed uses default filename when not provided
 */

describe('GlController', () => {
  let controller: GlController;
  let glService: Partial<Record<keyof GlService, jest.Mock>>;
  let coaLoader: Partial<Record<keyof CoaLoaderService, jest.Mock>>;

  beforeEach(async () => {
    glService = {
      getChartOfAccounts: jest.fn().mockResolvedValue([{ name: 'Assets' }]),
      getAccountsList: jest.fn().mockResolvedValue([{ accountCode: '1100' }]),
      createAccount: jest.fn().mockResolvedValue({ glAccountId: 'new-id' }),
      updateAccount: jest.fn().mockResolvedValue({ glAccountId: 'upd-id' }),
      getJournalEntries: jest.fn().mockResolvedValue([]),
      getJournalEntry: jest.fn().mockResolvedValue({ journalEntryId: 'je-1' }),
      postJournalEntry: jest.fn().mockResolvedValue({ entryNumber: 'JE-001' }),
      getTrialBalance: jest.fn().mockResolvedValue([]),
      getGeneralLedger: jest.fn().mockResolvedValue([]),
      getSettings: jest.fn().mockResolvedValue({ baseCurrency: 'AUD' }),
    };

    coaLoader = {
      loadFromFile: jest
        .fn()
        .mockResolvedValue({ created: 30, skipped: false }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlController],
      providers: [
        { provide: GlService, useValue: glService },
        {
          provide: 'CASBIN_ENFORCER',
          useValue: { enforce: jest.fn().mockResolvedValue(true) },
        },
        { provide: CoaLoaderService, useValue: coaLoader },
        { provide: AppConfigService, useValue: { reload: jest.fn() } },
        {
          provide: FxRevaluationService,
          useValue: {
            generateCandidates: jest.fn(),
            commitRevaluation: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<GlController>(GlController);
  });

  // =========================================================================
  // Accounts
  // =========================================================================

  describe('GET /gl/accounts', () => {
    it('should return tree format when format=tree', async () => {
      const result = await controller.getAccounts('tree');
      expect(glService.getChartOfAccounts).toHaveBeenCalled();
      expect(result).toEqual([{ name: 'Assets' }]);
    });

    it('should return flat list when no format specified', async () => {
      const result = await controller.getAccounts();
      expect(glService.getAccountsList).toHaveBeenCalled();
      expect(result).toEqual([{ accountCode: '1100' }]);
    });

    it('should return flat list for unknown format values', async () => {
      await controller.getAccounts('whatever' as unknown as 'tree');
      expect(glService.getAccountsList).toHaveBeenCalled();
      expect(glService.getChartOfAccounts).not.toHaveBeenCalled();
    });
  });

  describe('POST /gl/accounts', () => {
    it('should delegate to createAccount with body', async () => {
      const body: {
        accountCode: string;
        name: string;
        accountType: GLAccountType;
      } = {
        accountCode: '9000',
        name: 'Test',
        accountType: 'asset',
      };
      const mockUser = { userId: 'test-user', username: 'test-user' };
      await controller.createAccount(body, mockUser as unknown as JwtUser);
      expect(glService.createAccount).toHaveBeenCalledWith(body, 'test-user');
    });

    it('should pass parentAccountId and isGroup when provided', async () => {
      const body: {
        accountCode: string;
        name: string;
        accountType: GLAccountType;
        parentAccountId: string;
        isGroup: boolean;
        currencyCode: string;
      } = {
        accountCode: '9001',
        name: 'Child',
        accountType: 'expense',
        parentAccountId: 'parent-uuid',
        isGroup: true,
        currencyCode: 'USD',
      };
      const mockUser = { userId: 'test-user', username: 'test-user' };
      await controller.createAccount(body, mockUser as unknown as JwtUser);
      expect(glService.createAccount).toHaveBeenCalledWith(body, 'test-user');
    });
  });

  describe('PATCH /gl/accounts/:id', () => {
    it('should delegate to updateAccount with id and body', async () => {
      const mockUser = { userId: 'test-user', username: 'test-user' };
      await controller.updateAccount(
        'uuid-1',
        { name: 'New Name' },
        mockUser as unknown as JwtUser,
      );
      expect(glService.updateAccount).toHaveBeenCalledWith(
        'uuid-1',
        {
          name: 'New Name',
        },
        'test-user',
      );
    });

    it('should support isActive updates', async () => {
      const mockUser = { userId: 'test-user', username: 'test-user' };
      await controller.updateAccount(
        'uuid-2',
        { isActive: false },
        mockUser as unknown as JwtUser,
      );
      expect(glService.updateAccount).toHaveBeenCalledWith(
        'uuid-2',
        {
          isActive: false,
        },
        'test-user',
      );
    });
  });

  // =========================================================================
  // Journal Entries
  // =========================================================================

  describe('GET /gl/journal-entries', () => {
    it('should call getJournalEntries with no filters', async () => {
      await controller.getJournalEntries();
      expect(glService.getJournalEntries).toHaveBeenCalledWith({
        fromDate: undefined,
        toDate: undefined,
        sourceType: undefined,
        entryNumber: undefined,
        limit: undefined,
        page: undefined,
      });
    });

    it('should pass date range and source type filters', async () => {
      await controller.getJournalEntries(
        '2026-01-01',
        '2026-03-31',
        'sales_invoice',
      );
      expect(glService.getJournalEntries).toHaveBeenCalledWith({
        fromDate: '2026-01-01',
        toDate: '2026-03-31',
        sourceType: 'sales_invoice',
        entryNumber: undefined,
        limit: undefined,
        page: undefined,
      });
    });

    it('should parse limit string to integer', async () => {
      await controller.getJournalEntries(
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        '25',
      );
      expect(glService.getJournalEntries).toHaveBeenCalledWith({
        fromDate: undefined,
        toDate: undefined,
        sourceType: undefined,
        sourceId: undefined,
        entryNumber: undefined,
        limit: 25,
        page: undefined,
      });
    });
  });

  describe('GET /gl/journal-entries/:id', () => {
    it('should delegate to getJournalEntry', async () => {
      const result = await controller.getJournalEntry('je-uuid-1');
      expect(glService.getJournalEntry).toHaveBeenCalledWith('je-uuid-1');
      expect(result.journalEntryId).toBe('je-1');
    });
  });

  describe('POST /gl/journal-entries', () => {
    it('should create manual journal entry with correct meta', async () => {
      const body = {
        journalEntryId: 'je-uuid-1',
        lines: [
          { accountCode: '1100', debit: 100, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 100 },
        ],
        memo: 'Test JE',
        entryDate: '2026-03-22',
        actor: 'admin',
      };

      await controller.createManualJournalEntry(
        body as unknown as Parameters<
          typeof controller.createManualJournalEntry
        >[0],
        'admin',
      );

      expect(glService.postJournalEntry).toHaveBeenCalledWith(body.lines, {
        sourceType: 'manual',
        memo: 'Test JE',
        entryDate: '2026-03-22',
        actor: 'admin',
        journalEntryId: 'je-uuid-1',
      });
    });

    it('should set sourceType to manual regardless of what body contains', async () => {
      const body = {
        journalEntryId: 'je-uuid-2',
        lines: [
          { accountCode: '1100', debit: 50, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 50 },
        ],
      };

      await controller.createManualJournalEntry(
        body as unknown as Parameters<
          typeof controller.createManualJournalEntry
        >[0],
        undefined as any,
      );

      expect(glService.postJournalEntry).toHaveBeenCalledWith(body.lines, {
        sourceType: 'manual',
        memo: undefined,
        entryDate: undefined,
        actor: undefined,
        journalEntryId: 'je-uuid-2',
      });
    });
  });

  // =========================================================================
  // Reports
  // =========================================================================

  describe('GET /gl/trial-balance', () => {
    it('should call getTrialBalance without date filter', async () => {
      await controller.getTrialBalance();
      expect(glService.getTrialBalance).toHaveBeenCalledWith(
        undefined,
        undefined,
      );
    });

    it('should pass asOf date filter', async () => {
      await controller.getTrialBalance('2026-06-30');
      expect(glService.getTrialBalance).toHaveBeenCalledWith(
        '2026-06-30',
        undefined,
      );
    });
  });

  describe('GET /gl/general-ledger', () => {
    it('should call getGeneralLedger with no filters', async () => {
      await controller.getGeneralLedger();
      expect(glService.getGeneralLedger).toHaveBeenCalledWith({
        accountCode: undefined,
        fromDate: undefined,
        toDate: undefined,
        limit: undefined,
      });
    });

    it('should pass all filter parameters', async () => {
      await controller.getGeneralLedger(
        '1100',
        '2026-01-01',
        '2026-12-31',
        '50',
      );
      expect(glService.getGeneralLedger).toHaveBeenCalledWith({
        accountCode: '1100',
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        limit: 50,
      });
    });
  });

  // =========================================================================
  // Settings & Seed
  // =========================================================================

  describe('GET /gl/settings', () => {
    it('should return GL settings', async () => {
      const result = await controller.getSettings();
      expect(glService.getSettings).toHaveBeenCalled();
      expect(result.baseCurrency).toBe('AUD');
    });
  });

  describe('POST /gl/seed', () => {
    it('should use default filename when not specified', async () => {
      await controller.seedChartOfAccounts(
        {} as unknown as Parameters<typeof controller.seedChartOfAccounts>[0],
      );
      expect(coaLoader.loadFromFile).toHaveBeenCalledWith('au_standard.json');
    });

    it('should use custom filename when provided', async () => {
      await controller.seedChartOfAccounts({ filename: 'nz_standard.json' });
      expect(coaLoader.loadFromFile).toHaveBeenCalledWith('nz_standard.json');
    });

    it('should use default when body is empty object', async () => {
      await controller.seedChartOfAccounts({});
      expect(coaLoader.loadFromFile).toHaveBeenCalledWith('au_standard.json');
    });

    it('should return loader result', async () => {
      const result = await controller.seedChartOfAccounts(
        {} as unknown as Parameters<typeof controller.seedChartOfAccounts>[0],
      );
      expect(result).toEqual({ created: 30, skipped: false });
    });
  });
});
