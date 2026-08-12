import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import {
  suppliers,
  actors,
  supplierGroups,
  taxPositions,
} from '@herobm/db-schema';
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
            email: 'vendor1@example.com',
            telephone: '+61400000000',
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
      expect(result.data[0].emailAddress1).toBe('vendor1@example.com');
      expect(result.data[0].telephone1).toBe('+61400000000');
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

    it('should trim trailing spaces on email, phone, and fax from actor record', async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          name: 'Padded Vendor',
          email: '  accounts@padded.co   ',
          telephone: '  +1234567   ',
          fax: '  +7654321   ',
          stateCode: ACTOR_STATE.ACTIVE,
          isTaxRegistered: false,
        })
        .returning();

      const [s] = await pg.db
        .insert(suppliers)
        .values({
          actorId: act.actorId,
          vendorNumber: 'V-PAD',
          currencyCode: 'EUR',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        })
        .returning();

      const result = await service.findOne(s.vendorId);
      expect(result.emailAddress1).toBe('accounts@padded.co');
      expect(result.telephone1).toBe('+1234567');
      expect(result.fax).toBe('+7654321');
    });

    it('should return supplierGroupTaxPositionId when supplier belongs to a group with a tax position', async () => {
      const [tp] = await pg.db
        .insert(taxPositions)
        .values({
          code: 'GST-POS',
          title: 'GST Tax Position',
        })
        .returning();

      const [sg] = await pg.db
        .insert(supplierGroups)
        .values({
          name: 'Group with Tax Position',
          groupCode: 'GRP-TP',
          taxPositionId: tp.taxPositionId,
          isPurchasingBlocked: false,
          isPaymentBlocked: false,
        })
        .returning();

      const [act] = await pg.db
        .insert(actors)
        .values({
          name: 'Group Supplier',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: true,
        })
        .returning();

      const [s] = await pg.db
        .insert(suppliers)
        .values({
          actorId: act.actorId,
          vendorNumber: 'GRP-SUP-1',
          currencyCode: 'AUD',
          supplierGroupId: sg.supplierGroupId,
          taxPositionId: null,
          stateCode: SUPPLIER_STATE.ACTIVE,
          isPurchasingBlocked: false,
          source: 'app',
          createdBy: 'system',
        })
        .returning();

      const result = await service.findOne(s.vendorId);
      expect(result.supplierGroupTaxPositionId).toBe(tp.taxPositionId);
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
