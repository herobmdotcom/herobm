import { Test, TestingModule } from '@nestjs/testing';
import { AccountsWriteService } from './accounts-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { accounts, accountEvents } from '../drizzle/modbm-core-schema';
import { eq, sql } from 'drizzle-orm';

describe('AccountsWriteService', () => {
  const pg = setupPgliteSuite();
  let service: AccountsWriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsWriteService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: () => 'EUR' },
        },
      ],
    }).compile();

    service = module.get<AccountsWriteService>(AccountsWriteService);

    await pg.db.delete(accountEvents);
    await pg.db.delete(accounts);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a new account', async () => {
      const result = await service.create(
        { accountNumber: 'TEST001', name: 'Test', currencyCode: 'EUR' },
        'actor',
      );

      expect(result.accountNumber).toBe('TEST001');

      const rows = await pg.db
        .select()
        .from(accounts)
        .where(eq(accounts.accountNumber, 'TEST001'));
      expect(rows).toHaveLength(1);
    });

    it('should throw BadRequestException if accountNumber exists (manual check)', async () => {
      await pg.db.insert(accounts).values({
        accountNumber: 'TEST001',
        name: 'Existing',
        currencyCode: 'EUR',
      });

      await expect(
        service.create(
          { accountNumber: 'TEST001', name: 'Test', currencyCode: 'EUR' },
          'actor',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should roll back account creation if event logging fails (transactional atomicity)', async () => {
      // 1. Add a DB constraint that will fail for a specific actor name
      await pg.db.execute(
        sql`ALTER TABLE modbm_core.account_events ADD CONSTRAINT fail_on_test CHECK (actor != 'fail-actor')`,
      );

      // 2. Attempt to create with the forbidden actor
      // The service inserts into 'accounts' first, then 'account_events'.
      await expect(
        service.create(
          {
            accountNumber: 'ROLLBACK_001',
            name: 'Rollback Test',
            currencyCode: 'EUR',
          },
          'fail-actor',
        ),
      ).rejects.toThrow();

      // 3. Verify 'accounts' insertion was rolled back
      const rows = await pg.db
        .select()
        .from(accounts)
        .where(eq(accounts.accountNumber, 'ROLLBACK_001'));
      expect(rows).toHaveLength(0);

      // Cleanup constraint
      await pg.db.execute(
        sql`ALTER TABLE modbm_core.account_events DROP CONSTRAINT fail_on_test`,
      );
    });

    it('should throw native PG unique violation error (23505) if manual check is bypassed', async () => {
      await pg.db.insert(accounts).values({
        accountNumber: 'UNQ-001',
        name: 'First',
        currencyCode: 'EUR',
      });

      // Directly call DB to bypass service's manual existence check
      try {
        await pg.db.insert(accounts).values({
          accountNumber: 'UNQ-001',
          name: 'Duplicate',
          currencyCode: 'EUR',
        });
        fail('Should have thrown unique violation');
      } catch (e: any) {
        const code = e.code || e.cause?.code;
        expect(code).toBe('23505');
      }
    });

    it('should map native unique violation to ConflictException in service', async () => {
      await pg.db.insert(accounts).values({
        accountNumber: 'CONFLICT-001',
        name: 'First',
        currencyCode: 'EUR',
      });

      // Bypass manual check by mocking the select? No, just rely on race condition potential.
      // But we can just test that the service handles it if the manual check fails or is bypassed.

      // Here we just verify the service throws ConflictException if the DB insert fails.
      // Since we have the manual check, we have to bypass it to test the catch block.

      // Let's spy on the select and return nothing to bypass manual check
      jest.spyOn(pg.db, 'select').mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as any);

      try {
        await service.create(
          {
            accountNumber: 'CONFLICT-001',
            name: 'Duplicate',
            currencyCode: 'EUR',
          },
          'actor',
        );
        throw new Error('Should have thrown');
      } catch (e: any) {
        expect(e.message).toContain('already exists');
        expect(e.status || e.response?.statusCode).toBe(409);
      }
    });
  });

  describe('update', () => {
    it('should update an existing account', async () => {
      const [acc] = await pg.db
        .insert(accounts)
        .values({ accountNumber: 'TEST001', name: 'Old', currencyCode: 'EUR' })
        .returning();

      const result = await service.update(
        acc.accountId,
        { name: 'New' },
        'actor',
      );
      expect(result.name).toBe('New');
    });

    it('should throw NotFoundException if account does not exist', async () => {
      await expect(
        service.update(
          '00000000-0000-0000-0000-000000000999',
          { name: 'Updated' },
          'actor',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
