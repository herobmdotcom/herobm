import { Test, TestingModule } from '@nestjs/testing';
import { CustomersWriteService } from './customers-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { customers, masterDataEvents, actors } from '@herobm/db-schema';
import { eq, sql } from 'drizzle-orm';
import { getErrorMessage, CUSTOMER_STATE, ACTOR_STATE } from '@herobm/shared';

describe('CustomersWriteService', () => {
  const pg = setupPgliteSuite();
  let service: CustomersWriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CustomersWriteService,
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

    service = module.get<CustomersWriteService>(CustomersWriteService);
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
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Existing',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(customers).values({
        actorId: act.actorId,
        customerNumber: 'TEST001',
        currencyCode: 'EUR',
        stateCode: CUSTOMER_STATE.DRAFT,
        source: 'app',
        createdBy: 'system',
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
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'First',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(customers).values({
        actorId: act.actorId,
        customerNumber: 'UNQ-001',
        currencyCode: 'EUR',
        stateCode: CUSTOMER_STATE.DRAFT,
        source: 'app',
        createdBy: 'system',
      });

      // Directly call DB to bypass service's manual existence check
      try {
        const [act2] = await pg.db
          .insert(actors)
          .values({
            stateCode: ACTOR_STATE.ACTIVE,
            name: 'Duplicate',
            headquartersAddressLine1: 'AU',
            isTaxRegistered: false,
          })
          .returning();

        await pg.db.insert(customers).values({
          actorId: act2.actorId,
          customerNumber: 'UNQ-001',
          currencyCode: 'EUR',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        });
        fail('Should have thrown unique violation');
      } catch (e: unknown) {
        const code =
          (e as { code?: string; cause?: { code?: string } }).code ||
          (e as { code?: string; cause?: { code?: string } }).cause?.code;
        expect(code).toBe('23505');
      }
    });

    it('should propagate native unique violation error when manual check is bypassed', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'First',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(customers).values({
        actorId: act.actorId,
        customerNumber: 'CONFLICT-001',
        currencyCode: 'EUR',
        stateCode: CUSTOMER_STATE.DRAFT,
        source: 'app',
        createdBy: 'system',
      });

      // Let's spy on the select and return nothing to bypass manual check
      jest.spyOn(pg.db, 'select').mockReturnValueOnce({
        from: jest.fn().mockReturnValueOnce({
          where: jest.fn().mockReturnValueOnce({
            limit: jest.fn().mockResolvedValueOnce([]),
          }),
        }),
      } as never);

      try {
        await service.create(
          {
            customerNumber: 'CONFLICT-001',
            name: 'Duplicate',
            currencyCode: 'EUR',
            billingAddressCountry: 'AU',
          },
          'actor',
        );
        fail('Should have thrown unique violation');
      } catch (e: unknown) {
        const code =
          (e as { code?: string; cause?: { code?: string } }).code ||
          (e as { code?: string; cause?: { code?: string } }).cause?.code;
        expect(code).toBe('23505');
      }
    });
  });

  describe('update', () => {
    it('should update an existing customer', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          stateCode: ACTOR_STATE.ACTIVE,
          name: 'Old',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [acc] = await pg.db
        .insert(customers)
        .values({
          actorId: act.actorId,
          customerNumber: 'TEST001',
          currencyCode: 'EUR',
          stateCode: CUSTOMER_STATE.DRAFT,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const result = await service.update(
        acc.customerId,
        { name: 'New' },
        'actor',
        'admin',
      );

      const updatedActor = await pg.db
        .select()
        .from(actors)
        .where(eq(actors.actorId, act.actorId));
      expect(updatedActor[0].name).toBe('New');
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
