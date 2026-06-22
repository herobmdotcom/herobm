import { Test, TestingModule } from '@nestjs/testing';
import { AccountsWriteService } from './customers-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { customers, masterDataEvents } from '../drizzle/herobm-core-schema';
import { eq, sql } from 'drizzle-orm';
import { getErrorMessage } from '@herobm/shared';

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
          useValue: {
            homeCurrency: () => 'EUR',
            taxProviderMappings: () => ({}),
          },
        },
        {
          provide: 'CASBIN_ENFORCER',
          useValue: { enforce: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<AccountsWriteService>(AccountsWriteService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('create', () => {
    it('should create a new customer', async () => {
      const result = await service.create(
        {
          customerNumber: 'TEST001',
          name: 'Test',
          currencyCode: 'EUR',
          billingAddressCountry: 'AU',
        },
        'actor',
      );

      expect(result.customerNumber).toBe('TEST001');

      const rows = await pg.db
        .select()
        .from(customers)
        .where(eq(customers.customerNumber, 'TEST001'));
      expect(rows).toHaveLength(1);
    });

    it('should throw BadRequestException if customerNumber exists (manual check)', async () => {
      await pg.db.insert(customers).values({
        customerNumber: 'TEST001',
        name: 'Existing',
        currencyCode: 'EUR',
        billingAddressCountry: 'AU',
      });

      await expect(
        service.create(
          {
            customerNumber: 'TEST001',
            name: 'Test',
            currencyCode: 'EUR',
            billingAddressCountry: 'AU',
          },
          'actor',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw native PG unique violation error (23505) if manual check is bypassed', async () => {
      await pg.db.insert(customers).values({
        customerNumber: 'UNQ-001',
        name: 'First',
        currencyCode: 'EUR',
        billingAddressCountry: 'AU',
      });

      // Directly call DB to bypass service's manual existence check
      try {
        await pg.db.insert(customers).values({
          customerNumber: 'UNQ-001',
          name: 'Duplicate',
          currencyCode: 'EUR',
          billingAddressCountry: 'AU',
        });
        fail('Should have thrown unique violation');
      } catch (e: unknown) {
        const code =
          (e as { code?: string; cause?: { code?: string } }).code ||
          (e as { code?: string; cause?: { code?: string } }).cause?.code;
        expect(code).toBe('23505');
      }
    });

    it('should map native unique violation to ConflictException in service', async () => {
      await pg.db.insert(customers).values({
        customerNumber: 'CONFLICT-001',
        name: 'First',
        currencyCode: 'EUR',
        billingAddressCountry: 'AU',
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
      } as never);

      await expect(
        service.create(
          {
            customerNumber: 'CONFLICT-001',
            name: 'Duplicate',
            currencyCode: 'EUR',
            billingAddressCountry: 'AU',
          },
          'actor',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('update', () => {
    it('should update an existing customer', async () => {
      const [acc] = await pg.db
        .insert(customers)
        .values({
          customerNumber: 'TEST001',
          name: 'Old',
          currencyCode: 'EUR',
          billingAddressCountry: 'AU',
        })
        .returning();

      const result = await service.update(
        acc.customerId,
        { name: 'New' },
        'actor',
        'admin',
      );
      expect(result.name).toBe('New');
    });

    it('should throw NotFoundException if customer does not exist', async () => {
      await expect(
        service.update(
          '00000000-0000-4000-8000-000000000999',
          { name: 'Updated' },
          'actor',
          'admin',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
