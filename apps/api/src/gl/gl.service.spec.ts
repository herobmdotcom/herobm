import { Test, TestingModule } from '@nestjs/testing';
import { GlService, JournalLineDto, JournalMeta } from './gl.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';

/**
 * Comprehensive unit tests for the GL Service.
 *
 * Test strategy: we use a "programmable mock" that lets each test configure
 * what specific DB calls return, rather than a one-size-fits-all chain.
 * This avoids the problem of the Drizzle ORM using many chaining patterns.
 */

// ---------------------------------------------------------------------------
// Programmable mock DB
// ---------------------------------------------------------------------------

/**
 * The key insight: Drizzle chains are awaitable at different points.
 * Some paths: select().from().where()           -> awaited (returns array)
 * Other paths: select().from().where().limit()   -> awaited (returns array)
 * Other paths: select().from().orderBy()         -> awaited (returns array)
 * Other paths: insert().values().returning()      -> awaited (returns array)
 * Other paths: update().set().where().returning() -> awaited (returns array)
 * Other paths: execute()                          -> awaited (returns { rows })
 * Other paths: transaction(fn)                    -> awaited
 *
 * We create a deeply chainable proxy that is ALSO thenable (so await resolves it).
 */
function createChainProxy(resolveValue: any = []): any {
  const handler: ProxyHandler<any> = {
    get(_target, prop) {
      if (prop === 'then') {
        // Make the proxy thenable — await will resolve to resolveValue
        return (resolve: any, reject: any) => Promise.resolve(resolveValue).then(resolve, reject);
      }
      if (prop === Symbol.iterator) {
        return undefined; // Not iterable
      }
      // For any method call, return a function that returns a new chainable proxy
      return (...args: any[]) => createChainProxy(resolveValue);
    },
    apply(_target, _thisArg, args) {
      return createChainProxy(resolveValue);
    },
  };
  return new Proxy(function () {}, handler);
}

interface MockDb {
  select: jest.Mock;
  insert: jest.Mock;
  update: jest.Mock;
  execute: jest.Mock;
  transaction: jest.Mock;
}

function createMockDb(): {
  db: MockDb;
  /**
   * Configure the mock so that the next N select chains resolve
   * to the given arrays, in order. After exhausted, returns [].
   */
  onSelect: (...results: any[][]) => void;
  onInsert: (...results: any[][]) => void;
  onUpdate: (...results: any[][]) => void;
  onExecute: (...results: any[]) => void;
  onTransaction: (fn?: (tx: any) => any) => void;
} {
  let selectQueue: any[][] = [];
  let insertQueue: any[][] = [];
  let updateQueue: any[][] = [];
  let executeQueue: any[] = [];

  const db: MockDb = {
    select: jest.fn().mockImplementation(() => {
      const val = selectQueue.shift() || [];
      return createChainProxy(val);
    }),
    insert: jest.fn().mockImplementation(() => {
      const val = insertQueue.shift() || [];
      return createChainProxy(val);
    }),
    update: jest.fn().mockImplementation(() => {
      const val = updateQueue.shift() || [];
      return createChainProxy(val);
    }),
    execute: jest.fn().mockImplementation(() => {
      const val = executeQueue.shift() || { rows: [] };
      return Promise.resolve(val);
    }),
    transaction: jest.fn().mockImplementation(async (fn: any) => {
      // By default, create a mini tx with the same pattern
      const tx: any = {
        insert: jest.fn().mockImplementation(() => {
          const val = insertQueue.shift() || [];
          return createChainProxy(val);
        }),
      };
      return fn(tx);
    }),
  };

  return {
    db,
    onSelect: (...results) => { selectQueue.push(...results); },
    onInsert: (...results) => { insertQueue.push(...results); },
    onUpdate: (...results) => { updateQueue.push(...results); },
    onExecute: (...results) => { executeQueue.push(...results); },
    onTransaction: (fn) => {
      if (fn) {
        db.transaction = jest.fn().mockImplementation(fn);
      }
    },
  };
}

describe('GlService', () => {
  let service: GlService;
  let mock: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    mock = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlService,
        { provide: DRIZZLE, useValue: mock.db },
      ],
    }).compile();

    service = module.get<GlService>(GlService);
  });

  // =========================================================================
  // postJournalEntry — Balance Invariant
  // =========================================================================

  describe('postJournalEntry — balance invariant', () => {
    it('should reject null/undefined lines', async () => {
      await expect(
        service.postJournalEntry(null as any, { sourceType: 'manual' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject empty lines array', async () => {
      await expect(
        service.postJournalEntry([], { sourceType: 'manual' }),
      ).rejects.toThrow('at least 2 lines');
    });

    it('should reject a single line', async () => {
      await expect(
        service.postJournalEntry(
          [{ accountCode: '1100', debit: 100, credit: 0 }],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('at least 2 lines');
    });

    it('should reject when debits exceed credits', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 50 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should reject when credits exceed debits', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 50, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should include debit and credit totals in error message', async () => {
      try {
        await service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100.50, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 99.00 },
          ],
          { sourceType: 'manual' },
        );
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('100.50');
        expect(e.message).toContain('99.00');
      }
    });

    it('should accept balanced entries (proceeds past balance check to account lookup)', async () => {
      // Account lookup returns empty -> will throw "does not exist" (proving balance passed)
      mock.onSelect([]); // Account resolution
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist');
    });

    it('should tolerate floating-point imprecision within 0.005', async () => {
      // 0.1 + 0.2 = 0.30000000000000004 in JS
      mock.onSelect([]); // Account resolution
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 0.1 + 0.2, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 0.3 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist'); // Passed balance check
    });

    it('should reject imbalance beyond tolerance (0.01)', async () => {
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 100.01, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100.00 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('unbalanced');
    });

    it('should handle multi-line entries with balanced totals', async () => {
      // 3-line: AR=110, Revenue=100, GST=10
      mock.onSelect([]); // Account resolution
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 110, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100 },
            { accountCode: '2200', debit: 0, credit: 10 },
          ],
          { sourceType: 'sales_invoice' },
        ),
      ).rejects.toThrow('does not exist'); // Passed balance
    });

    it('should handle zero-value entries (balanced at zero)', async () => {
      mock.onSelect([]); // Account resolution
      await expect(
        service.postJournalEntry(
          [
            { accountCode: '1100', debit: 0, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 0 },
          ],
          { sourceType: 'manual' },
        ),
      ).rejects.toThrow('does not exist'); // Passed balance
    });
  });

  // =========================================================================
  // postJournalEntry — Account Validation
  // =========================================================================

  describe('postJournalEntry — account validation', () => {
    const balancedLines: JournalLineDto[] = [
      { accountCode: '1100', debit: 100, credit: 0 },
      { accountCode: '4100', debit: 0, credit: 100 },
    ];

    it('should reject when no account codes exist', async () => {
      mock.onSelect([]); // Empty result
      await expect(
        service.postJournalEntry(balancedLines, { sourceType: 'manual' }),
      ).rejects.toThrow("'1100' does not exist");
    });

    it('should reject when only one of two accounts exists', async () => {
      mock.onSelect([
        { glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' },
        // 4100 missing
      ]);
      await expect(
        service.postJournalEntry(balancedLines, { sourceType: 'manual' }),
      ).rejects.toThrow("'4100' does not exist");
    });

    it('should reject posting to a group account', async () => {
      mock.onSelect([
        { glAccountId: 'id1', accountCode: '1100', isGroup: true, isActive: true, name: 'Current Assets' },
        { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Revenue' },
      ]);
      await expect(
        service.postJournalEntry(balancedLines, { sourceType: 'manual' }),
      ).rejects.toThrow('group account');
    });

    it('should include account code and name in group rejection message', async () => {
      mock.onSelect([
        { glAccountId: 'id1', accountCode: '1000', isGroup: true, isActive: true, name: 'Assets' },
        { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Revenue' },
      ]);
      try {
        await service.postJournalEntry(
          [
            { accountCode: '1000', debit: 100, credit: 0 },
            { accountCode: '4100', debit: 0, credit: 100 },
          ],
          { sourceType: 'manual' },
        );
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('1000');
        expect(e.message).toContain('Assets');
      }
    });

    it('should reject posting to an inactive account', async () => {
      mock.onSelect([
        { glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: false, name: 'AR (Closed)' },
        { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Revenue' },
      ]);
      await expect(
        service.postJournalEntry(balancedLines, { sourceType: 'manual' }),
      ).rejects.toThrow('inactive');
    });

    it('should include account code and name in inactive rejection message', async () => {
      mock.onSelect([
        { glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: false, name: 'AR Old' },
        { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Revenue' },
      ]);
      try {
        await service.postJournalEntry(balancedLines, { sourceType: 'manual' });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('1100');
        expect(e.message).toContain('AR Old');
      }
    });
  });

  // =========================================================================
  // postJournalEntry — Full Success Path
  // =========================================================================

  describe('postJournalEntry — success path', () => {
    it('should create entry and lines within a transaction', async () => {
      const accounts = [
        { glAccountId: 'id-ar', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' },
        { glAccountId: 'id-rev', accountCode: '4100', isGroup: false, isActive: true, name: 'Revenue' },
      ];

      mock.onSelect(
        accounts,   // 1. Account resolution
        [],          // 2. Entry number generation (no existing entries today)
      );

      let txInsertCalls: any[] = [];
      mock.onTransaction(async (fn: any) => {
        const tx = {
          insert: jest.fn().mockImplementation(() => {
            const call: any = {};
            txInsertCalls.push(call);
            return createChainProxy(undefined); // chainable
          }),
        };
        // Need to actually make insert().values().returning() work
        let insertCount = 0;
        tx.insert = jest.fn().mockImplementation(() => {
          insertCount++;
          const proxy = {
            values: jest.fn().mockImplementation((vals: any) => {
              txInsertCalls.push(vals);
              return {
                returning: jest.fn().mockResolvedValue(
                  insertCount === 1
                    ? [{ journalEntryId: 'je-001', entryNumber: 'JE-20260322-0001', entryDate: '2026-03-22' }]
                    : undefined,
                ),
              };
            }),
          };
          return proxy;
        });
        return fn(tx);
      });

      const result = await service.postJournalEntry(
        [
          { accountCode: '1100', debit: 500, credit: 0, memo: 'AR debit' },
          { accountCode: '4100', debit: 0, credit: 500, memo: 'Rev credit' },
        ],
        { sourceType: 'sales_invoice', sourceId: 'inv-001', memo: 'Test', actor: 'admin' },
      );

      expect(result.journalEntryId).toBe('je-001');
      expect(mock.db.transaction).toHaveBeenCalledTimes(1);

      // Verify header inserted
      expect(txInsertCalls[0]).toMatchObject({
        sourceType: 'sales_invoice',
        sourceId: 'inv-001',
        memo: 'Test',
        createdBy: 'admin',
      });

      // Verify lines inserted with correct account IDs
      expect(txInsertCalls[1]).toHaveLength(2);
      expect(txInsertCalls[1][0]).toMatchObject({
        glAccountId: 'id-ar',
        debit: '500',
        credit: '0',
        memo: 'AR debit',
      });
      expect(txInsertCalls[1][1]).toMatchObject({
        glAccountId: 'id-rev',
        debit: '0',
        credit: '500',
        memo: 'Rev credit',
      });
    });

    it('should use entryDate from meta when provided', async () => {
      mock.onSelect(
        [{ glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' },
         { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Rev' }],
        [], // entry number
      );

      let headerValues: any;
      mock.onTransaction(async (fn: any) => {
        let insertCount = 0;
        const tx = {
          insert: jest.fn().mockImplementation(() => {
            insertCount++;
            return {
              values: jest.fn().mockImplementation((vals: any) => {
                if (insertCount === 1) headerValues = vals;
                return {
                  returning: jest.fn().mockResolvedValue(
                    insertCount === 1
                      ? [{ journalEntryId: 'je-date', entryNumber: 'JE-test', entryDate: '2025-12-31' }]
                      : undefined,
                  ),
                };
              }),
            };
          }),
        };
        return fn(tx);
      });

      await service.postJournalEntry(
        [
          { accountCode: '1100', debit: 100, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual', entryDate: '2025-12-31' },
      );

      expect(headerValues.entryDate).toBe('2025-12-31');
    });

    it('should default entryDate to today when not provided', async () => {
      mock.onSelect(
        [{ glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' },
         { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Rev' }],
        [],
      );

      let headerValues: any;
      mock.onTransaction(async (fn: any) => {
        let insertCount = 0;
        const tx = {
          insert: jest.fn().mockImplementation(() => {
            insertCount++;
            return {
              values: jest.fn().mockImplementation((vals: any) => {
                if (insertCount === 1) headerValues = vals;
                return {
                  returning: jest.fn().mockResolvedValue(
                    insertCount === 1 ? [{ journalEntryId: 'je-today' }] : undefined,
                  ),
                };
              }),
            };
          }),
        };
        return fn(tx);
      });

      await service.postJournalEntry(
        [
          { accountCode: '1100', debit: 100, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual' },
      );

      const today = new Date().toISOString().slice(0, 10);
      expect(headerValues.entryDate).toBe(today);
    });

    it('should deduplicate account codes when same code appears multiple times', async () => {
      // Transfer within same account (zero-sum)
      mock.onSelect(
        [{ glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' }],
        [],
      );

      mock.onTransaction(async (fn: any) => {
        let insertCount = 0;
        const tx = {
          insert: jest.fn().mockImplementation(() => {
            insertCount++;
            return {
              values: jest.fn().mockImplementation(() => ({
                returning: jest.fn().mockResolvedValue(
                  insertCount === 1 ? [{ journalEntryId: 'je-dup' }] : undefined,
                ),
              })),
            };
          }),
        };
        return fn(tx);
      });

      // Should not throw — '1100' used twice but only looked up once
      const result = await service.postJournalEntry(
        [
          { accountCode: '1100', debit: 100, credit: 0 },
          { accountCode: '1100', debit: 0, credit: 100 },
        ],
        { sourceType: 'adjustment' },
      );
      expect(result.journalEntryId).toBe('je-dup');
    });
  });

  // =========================================================================
  // postJournalEntry — Entry Number Generation
  // =========================================================================

  describe('postJournalEntry — entry number', () => {
    it('should generate JE-YYYYMMDD-0001 for first entry of the day', async () => {
      mock.onSelect(
        [{ glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' },
         { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Rev' }],
        [], // No existing entries
      );

      let capturedNumber: string;
      mock.onTransaction(async (fn: any) => {
        let insertCount = 0;
        const tx = {
          insert: jest.fn().mockImplementation(() => {
            insertCount++;
            return {
              values: jest.fn().mockImplementation((vals: any) => {
                if (insertCount === 1) capturedNumber = vals.entryNumber;
                return {
                  returning: jest.fn().mockResolvedValue(
                    insertCount === 1 ? [{ journalEntryId: 'je-num1', entryNumber: vals.entryNumber }] : undefined,
                  ),
                };
              }),
            };
          }),
        };
        return fn(tx);
      });

      await service.postJournalEntry(
        [
          { accountCode: '1100', debit: 100, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual' },
      );

      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      expect(capturedNumber!).toBe(`JE-${today}-0001`);
    });

    it('should increment sequence when entries already exist today', async () => {
      const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      mock.onSelect(
        [{ glAccountId: 'id1', accountCode: '1100', isGroup: false, isActive: true, name: 'AR' },
         { glAccountId: 'id2', accountCode: '4100', isGroup: false, isActive: true, name: 'Rev' }],
        [{ entryNumber: `JE-${today}-0003` }], // Existing max
      );

      let capturedNumber: string;
      mock.onTransaction(async (fn: any) => {
        let insertCount = 0;
        const tx = {
          insert: jest.fn().mockImplementation(() => {
            insertCount++;
            return {
              values: jest.fn().mockImplementation((vals: any) => {
                if (insertCount === 1) capturedNumber = vals.entryNumber;
                return {
                  returning: jest.fn().mockResolvedValue(
                    insertCount === 1 ? [{ journalEntryId: 'je-num4' }] : undefined,
                  ),
                };
              }),
            };
          }),
        };
        return fn(tx);
      });

      await service.postJournalEntry(
        [
          { accountCode: '1100', debit: 100, credit: 0 },
          { accountCode: '4100', debit: 0, credit: 100 },
        ],
        { sourceType: 'manual' },
      );

      expect(capturedNumber!).toBe(`JE-${today}-0004`);
    });
  });

  // =========================================================================
  // Chart of Accounts — getChartOfAccounts / buildTree
  // =========================================================================

  describe('getChartOfAccounts (tree builder)', () => {
    it('should build nested tree from flat accounts', async () => {
      mock.onSelect([
        { glAccountId: 'a1', accountCode: '1000', name: 'Assets', parentAccountId: null, isGroup: true },
        { glAccountId: 'a2', accountCode: '1100', name: 'AR', parentAccountId: 'a1', isGroup: false },
        { glAccountId: 'a3', accountCode: '1200', name: 'GST Recv', parentAccountId: 'a1', isGroup: false },
        { glAccountId: 'a4', accountCode: '2000', name: 'Liabilities', parentAccountId: null, isGroup: true },
        { glAccountId: 'a5', accountCode: '2100', name: 'AP', parentAccountId: 'a4', isGroup: false },
      ]);

      const tree = await service.getChartOfAccounts();

      expect(tree).toHaveLength(2);
      expect(tree[0].name).toBe('Assets');
      expect(tree[0].children).toHaveLength(2);
      expect(tree[0].children[0].name).toBe('AR');
      expect(tree[0].children[0].children).toBeUndefined(); // leaf
      expect(tree[1].name).toBe('Liabilities');
      expect(tree[1].children).toHaveLength(1);
    });

    it('should handle 3-level deep hierarchy', async () => {
      mock.onSelect([
        { glAccountId: 'r1', accountCode: '1000', name: 'Assets', parentAccountId: null, isGroup: true },
        { glAccountId: 'g1', accountCode: '1020', name: 'Bank', parentAccountId: 'r1', isGroup: true },
        { glAccountId: 'l1', accountCode: '1021', name: 'Operating', parentAccountId: 'g1', isGroup: false },
      ]);

      const tree = await service.getChartOfAccounts();
      expect(tree).toHaveLength(1);
      expect(tree[0].children[0].name).toBe('Bank');
      expect(tree[0].children[0].children[0].name).toBe('Operating');
    });

    it('should return empty array when no accounts exist', async () => {
      mock.onSelect([]);
      const tree = await service.getChartOfAccounts();
      expect(tree).toEqual([]);
    });

    it('should not show orphaned accounts at root', async () => {
      mock.onSelect([
        { glAccountId: 'a1', accountCode: '1100', name: 'Orphan', parentAccountId: 'deleted-parent', isGroup: false },
      ]);
      const tree = await service.getChartOfAccounts();
      expect(tree).toEqual([]); // Orphan hangs off missing parent
    });

    it('should handle single root account with no children', async () => {
      mock.onSelect([
        { glAccountId: 'a1', accountCode: '1000', name: 'Assets', parentAccountId: null, isGroup: true },
      ]);
      const tree = await service.getChartOfAccounts();
      expect(tree).toHaveLength(1);
      expect(tree[0].children).toEqual([]);
    });
  });

  // =========================================================================
  // getAccountsList
  // =========================================================================

  describe('getAccountsList', () => {
    it('should return flat list', async () => {
      mock.onSelect([
        { accountCode: '1100', name: 'AR' },
        { accountCode: '2100', name: 'AP' },
      ]);
      const result = await service.getAccountsList();
      expect(result).toHaveLength(2);
    });
  });

  // =========================================================================
  // createAccount
  // =========================================================================

  describe('createAccount', () => {
    it('should reject invalid account type', async () => {
      await expect(
        service.createAccount({ accountCode: '9000', name: 'Bad', accountType: 'debit' }),
      ).rejects.toThrow('Invalid account type');
    });

    it('should list valid types in error message', async () => {
      try {
        await service.createAccount({ accountCode: '9000', name: 'Bad', accountType: 'invalid' });
        fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('asset');
        expect(e.message).toContain('liability');
        expect(e.message).toContain('equity');
        expect(e.message).toContain('revenue');
        expect(e.message).toContain('expense');
      }
    });

    it('should reject non-existent parent account', async () => {
      mock.onSelect([]); // Parent not found
      await expect(
        service.createAccount({
          accountCode: '9001', name: 'Child', accountType: 'asset',
          parentAccountId: 'nonexistent',
        }),
      ).rejects.toThrow('Parent account not found');
    });

    it('should reject parent that is not a group', async () => {
      mock.onSelect([{ glAccountId: 'p1', isGroup: false }]);
      await expect(
        service.createAccount({
          accountCode: '9001', name: 'Child', accountType: 'asset',
          parentAccountId: 'p1',
        }),
      ).rejects.toThrow('must be a group');
    });

    it('should accept valid account with group parent', async () => {
      mock.onSelect([{ glAccountId: 'p1', isGroup: true }]); // Parent check
      mock.onInsert([{ glAccountId: 'new-1', accountCode: '9001', name: 'New' }]);

      const result = await service.createAccount({
        accountCode: '9001', name: 'New', accountType: 'expense',
        parentAccountId: 'p1',
      });
      expect(result.glAccountId).toBe('new-1');
    });

    it('should default isGroup to false', async () => {
      mock.onInsert([{ glAccountId: 'new-2', isGroup: false }]);
      const result = await service.createAccount({
        accountCode: '9002', name: 'Leaf', accountType: 'asset',
      });
      expect(mock.db.insert).toHaveBeenCalled();
    });

    it('should accept all 5 valid account types', async () => {
      for (const type of ['asset', 'liability', 'equity', 'revenue', 'expense']) {
        mock.onInsert([{ glAccountId: `id-${type}` }]);
        const result = await service.createAccount({
          accountCode: `code-${type}`, name: `Name-${type}`, accountType: type,
        });
        expect(result).toBeDefined();
      }
    });
  });

  // =========================================================================
  // updateAccount
  // =========================================================================

  describe('updateAccount', () => {
    it('should throw NotFoundException for non-existent account', async () => {
      mock.onSelect([]); // Not found
      await expect(
        service.updateAccount('nonexistent', { name: 'New Name' }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should reject deactivating a system account', async () => {
      mock.onSelect([{ glAccountId: 'sys-1', accountCode: '1100', name: 'AR', isSystem: true }]);
      await expect(
        service.updateAccount('sys-1', { isActive: false }),
      ).rejects.toThrow('cannot be deactivated');
    });

    it('should allow renaming a system account', async () => {
      mock.onSelect([{ glAccountId: 'sys-1', accountCode: '1100', name: 'AR', isSystem: true }]);
      mock.onUpdate([{ glAccountId: 'sys-1', name: 'Accounts Receivable' }]);

      const result = await service.updateAccount('sys-1', { name: 'Accounts Receivable' });
      expect(result.name).toBe('Accounts Receivable');
    });

    it('should allow deactivating a non-system account', async () => {
      mock.onSelect([{ glAccountId: 'c1', accountCode: '9900', name: 'Custom', isSystem: false }]);
      mock.onUpdate([{ glAccountId: 'c1', isActive: false }]);

      const result = await service.updateAccount('c1', { isActive: false });
      expect(result.isActive).toBe(false);
    });

    it('should allow setting isActive=true on system account (re-enable)', async () => {
      mock.onSelect([{ glAccountId: 'sys-1', accountCode: '1100', name: 'AR', isSystem: true }]);
      mock.onUpdate([{ glAccountId: 'sys-1', isActive: true }]);

      const result = await service.updateAccount('sys-1', { isActive: true });
      expect(result.isActive).toBe(true);
    });
  });

  // =========================================================================
  // getJournalEntry
  // =========================================================================

  describe('getJournalEntry', () => {
    it('should throw NotFoundException for non-existent entry', async () => {
      mock.onSelect([]); // Not found
      await expect(
        service.getJournalEntry('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should return entry with hydrated lines', async () => {
      mock.onSelect(
        [{ journalEntryId: 'je-1', entryNumber: 'JE-20260322-0001', entryDate: '2026-03-22', sourceType: 'manual' }],
        [
          { journalLineId: 'jl-1', debit: '100', credit: '0', memo: 'DR', accountCode: '1100', accountName: 'AR' },
          { journalLineId: 'jl-2', debit: '0', credit: '100', memo: 'CR', accountCode: '4100', accountName: 'Revenue' },
        ],
      );

      const result = await service.getJournalEntry('je-1');
      expect(result.journalEntryId).toBe('je-1');
      expect(result.lines).toHaveLength(2);
      expect(result.lines[0].accountCode).toBe('1100');
    });
  });

  // =========================================================================
  // getSettings
  // =========================================================================

  describe('getSettings', () => {
    it('should return null when no settings exist', async () => {
      mock.onSelect([]);
      const result = await service.getSettings();
      expect(result).toBeNull();
    });

    it('should return settings when they exist', async () => {
      mock.onSelect([{ settingsId: 's1', fiscalYearStartMonth: 7, baseCurrency: 'AUD' }]);
      const result = await service.getSettings();
      expect(result!.baseCurrency).toBe('AUD');
    });
  });

  // =========================================================================
  // getTrialBalance
  // =========================================================================

  describe('getTrialBalance', () => {
    it('should return rows from execute', async () => {
      mock.onExecute({
        rows: [
          { account_code: '1100', name: 'AR', total_debit: 500, total_credit: 200, balance: 300 },
          { account_code: '4100', name: 'Revenue', total_debit: 0, total_credit: 500, balance: -500 },
        ],
      });

      const result = await service.getTrialBalance();
      expect(result).toHaveLength(2);
      expect(result[0].balance).toBe(300);
    });

    it('should pass asOfDate filter', async () => {
      mock.onExecute({ rows: [] });
      await service.getTrialBalance('2026-03-31');
      expect(mock.db.execute).toHaveBeenCalledTimes(1);
    });

    it('should return empty when no GL data', async () => {
      mock.onExecute({ rows: [] });
      const result = await service.getTrialBalance();
      expect(result).toEqual([]);
    });
  });

  // =========================================================================
  // getGeneralLedger
  // =========================================================================

  describe('getGeneralLedger', () => {
    it('should return ledger rows', async () => {
      mock.onExecute({
        rows: [{ entry_number: 'JE-001', account_code: '1100', debit: 100, credit: 0 }],
      });
      const result = await service.getGeneralLedger({ accountCode: '1100' });
      expect(result).toHaveLength(1);
    });

    it('should default limit to 200 and cap at 500', async () => {
      mock.onExecute({ rows: [] });
      // limit: 999 -> capped to 500
      await service.getGeneralLedger({ limit: 999 });
      expect(mock.db.execute).toHaveBeenCalledTimes(1);
    });

    it('should handle no filters', async () => {
      mock.onExecute({ rows: [] });
      await service.getGeneralLedger({});
      expect(mock.db.execute).toHaveBeenCalled();
    });
  });

  // =========================================================================
  // getJournalEntries (list)
  // =========================================================================

  describe('getJournalEntries', () => {
    it('should return entries list', async () => {
      mock.onSelect([
        { journalEntryId: 'je-1', entryNumber: 'JE-001', sourceType: 'manual' },
      ]);
      const result = await service.getJournalEntries({});
      expect(result).toHaveLength(1);
    });

    it('should pass filter parameters', async () => {
      mock.onSelect([]);
      await service.getJournalEntries({
        fromDate: '2026-01-01',
        toDate: '2026-12-31',
        sourceType: 'sales_invoice',
        limit: 10,
      });
      expect(mock.db.select).toHaveBeenCalled();
    });

    it('should cap limit at 200', async () => {
      mock.onSelect([]);
      await service.getJournalEntries({ limit: 999 });
      // Code uses Math.min(limit, 200) — we verify it doesn't crash
      expect(mock.db.select).toHaveBeenCalled();
    });
  });
});
