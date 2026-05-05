import { Test, TestingModule } from '@nestjs/testing';
import { AccountsWriteService } from './accounts-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { createMemoryDb } from '../../test/utils/memory-db';
import { accounts, accountEvents } from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

describe('AccountsWriteService', () => {
  let service: AccountsWriteService;
  let db: PgliteDatabase<any>;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsWriteService,
        { provide: DRIZZLE, useValue: db },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: () => 'EUR' },
        },
      ],
    }).compile();

    service = module.get<AccountsWriteService>(AccountsWriteService);

    await db.delete(accountEvents);
    await db.delete(accounts);
  });

  describe('create', () => {
    it('should create a new account', async () => {
      const result = await service.create(
        { accountNumber: 'TEST001', name: 'Test', currencyCode: 'EUR' },
        'actor',
      );

      expect(result.accountNumber).toBe('TEST001');

      const rows = await db
        .select()
        .from(accounts)
        .where(eq(accounts.accountNumber, 'TEST001'));
      expect(rows).toHaveLength(1);
    });

    it('should throw BadRequestException if accountNumber exists', async () => {
      await db.insert(accounts).values({
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
  });

  describe('update', () => {
    it('should update an existing account', async () => {
      const [acc] = await db
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
