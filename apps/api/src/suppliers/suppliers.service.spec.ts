import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { suppliers, actors } from '@herobm/db-schema';
import { SUPPLIER_STATE, ACTOR_STATE } from '@herobm/shared';
import { eq } from 'drizzle-orm';

describe('SuppliersService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SuppliersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: DRIZZLE, useValue: pg.db }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);

    await pg.db.delete(suppliers);
  });

  describe('findAll', () => {
    it('should return paginated suppliers', async () => {
      const acts = await pg.db
        .insert(actors)
        .values([
          {
            name: 'Vendor 1',
            headquartersAddressLine1: 'AU',
            stateCode: ACTOR_STATE.ACTIVE,
            isTaxRegistered: false,
          },
          {
            name: 'Vendor 2',
            headquartersAddressLine1: 'AU',
            stateCode: ACTOR_STATE.ACTIVE,
            isTaxRegistered: false,
          },
        ])
        .returning();

      await pg.db.insert(suppliers).values([
        {
          actorId: acts[0].actorId,
          vendorNumber: 'V1',
          currencyCode: 'EUR',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        },
        {
          actorId: acts[1].actorId,
          vendorNumber: 'V2',
          currencyCode: 'USD',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        },
      ]);

      const result = await service.findAll({});
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply search filter', async () => {
      const acts = await pg.db
        .insert(actors)
        .values([
          {
            name: 'Alpha',
            headquartersAddressLine1: 'AU',
            stateCode: ACTOR_STATE.ACTIVE,
            isTaxRegistered: false,
          },
          {
            name: 'Beta',
            headquartersAddressLine1: 'AU',
            stateCode: ACTOR_STATE.ACTIVE,
            isTaxRegistered: false,
          },
        ])
        .returning();

      await pg.db.insert(suppliers).values([
        {
          actorId: acts[0].actorId,
          vendorNumber: 'V1',
          currencyCode: 'EUR',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        },
        {
          actorId: acts[1].actorId,
          vendorNumber: 'V2',
          currencyCode: 'USD',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        },
      ]);

      const result = await service.findAll({ q: 'alpha' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Alpha');
    });
  });

  describe('findOne', () => {
    it('should return a single supplier', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          name: 'Existing Vendor',
          headquartersAddressLine1: 'AU',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      const [s] = await pg.db
        .insert(suppliers)
        .values({
          actorId: act.actorId,
          vendorNumber: 'V-EX',
          currencyCode: 'EUR',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        })
        .returning();

      const result = await service.findOne(s.vendorId);
      expect(result.name).toBe('Existing Vendor');
    });

    it('should throw NotFoundException if not found', async () => {
      await expect(
        service.findOne('00000000-0000-4000-8000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('assessRisk', () => {
    it('should retrieve supplier and assess risk correctly', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          name: 'Risk Vendor',
          headquartersAddressLine1: 'AU',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      const [s] = await pg.db
        .insert(suppliers)
        .values({
          actorId: act.actorId,
          vendorNumber: 'V-RISK',
          currencyCode: 'EUR',
          stateCode: SUPPLIER_STATE.INACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        })
        .returning();

      const risk = await service.assessRisk(s.vendorId);
      expect(risk.isPurchasingBlocked).toBe(true);
      expect(risk.purchasingBlockReasons).toContain('supplier_inactive');
      expect(risk.isPaymentBlocked).toBe(true);
      expect(risk.paymentBlockReasons).toContain('supplier_inactive');
    });

    it('should throw NotFoundException if vendor does not exist', async () => {
      await expect(
        service.assessRisk('00000000-0000-4000-8000-000000000999'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
