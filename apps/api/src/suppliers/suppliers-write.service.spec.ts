import { masterDataEvents, organizations, suppliers } from '@herobm/db-schema';
import { ORGANIZATION_STATE, SUPPLIER_STATE } from '@herobm/shared';
import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { AppConfigService } from '../settings/app-config.service';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { SuppliersWriteService } from './suppliers-write.service';

describe('SuppliersWriteService', () => {
  const pg = setupPgliteSuite({ skipSeeds: true });
  let service: SuppliersWriteService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersWriteService,
        { provide: DRIZZLE, useValue: pg.db },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: jest.fn().mockReturnValue('EUR') },
        },
        {
          provide: 'CASBIN_ENFORCER',
          useValue: { enforce: jest.fn().mockResolvedValue(true) },
        },
      ],
    }).compile();

    service = module.get<SuppliersWriteService>(SuppliersWriteService);

    // Clean transactional data
    await pg.db.delete(masterDataEvents);
    await pg.db.delete(suppliers);
    await pg.db.delete(organizations);
  });

  describe('create', () => {
    it('should create a supplier if vendor number is unique', async () => {
      const dto = {
        vendorNumber: 'V-001',
        name: 'Vendor 1',
        address1Country: 'AU',
      };
      const result = await service.create(dto, 'test-actor');
      expect(result.vendorNumber).toBe('V-001');

      const rows = await pg.db
        .select()
        .from(suppliers)
        .where(eq(suppliers.vendorNumber, 'V-001'));
      expect(rows).toHaveLength(1);
    });

    it('should throw if vendor number already exists', async () => {
      const [act] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Existing',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(suppliers).values({
        organizationId: act.organizationId,
        vendorNumber: 'V-001',
        currencyCode: 'EUR',
        stateCode: SUPPLIER_STATE.ACTIVE,
        source: 'app',
        isPurchasingBlocked: false,
        createdBy: 'system',
      });

      const dto = {
        vendorNumber: 'V-001',
        name: 'Duplicate',
        address1Country: 'AU',
      };
      await expect(service.create(dto, 'test-actor')).rejects.toThrow();
    });
  });

  describe('update', () => {
    let existingId: string;
    let existingOrgId: string;

    beforeEach(async () => {
      const [act] = await pg.db
        .insert(organizations)
        .values({
          stateCode: ORGANIZATION_STATE.ACTIVE,
          name: 'Old Name',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      const [s] = await pg.db
        .insert(suppliers)
        .values({
          organizationId: act.organizationId,
          vendorNumber: 'V-EX',
          currencyCode: 'EUR',
          stateCode: SUPPLIER_STATE.ACTIVE,
          source: 'app',
          isPurchasingBlocked: false,
          createdBy: 'system',
        })
        .returning();
      existingOrgId = act.organizationId;
      existingId = s.vendorId;
    });

    it('should update an existing supplier', async () => {
      const result = await service.update(
        existingId,
        { name: 'New Name' },
        'test-actor',
      );
      const [updatedOrg] = await pg.db
        .select()
        .from(organizations)
        .where(eq(organizations.organizationId, existingOrgId));
      expect(updatedOrg.name).toBe('New Name');
    });

    it('should throw NotFoundException if supplier not found', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000999';
      await expect(
        service.update(unknownId, { name: 'New' }, 'test-actor'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('bulkUpdate', () => {
    it('should bulk update fields across multiple suppliers', async () => {
      const s1 = await service.create(
        { vendorNumber: 'BSUP-001', name: 'Bulk Sup 1', address1Country: 'AU' },
        'admin',
      );
      const s2 = await service.create(
        { vendorNumber: 'BSUP-002', name: 'Bulk Sup 2', address1Country: 'AU' },
        'admin',
      );

      const res = await service.bulkUpdate(
        {
          ids: [s1.vendorId, s2.vendorId],
          isPurchasingBlocked: true,
        },
        'admin',
      );

      expect(res).toEqual({ updatedCount: 2, skippedCount: 0 });

      const updated = await pg.db
        .select()
        .from(suppliers)
        .where(eq(suppliers.vendorId, s1.vendorId));
      expect(updated[0].isPurchasingBlocked).toBe(true);
    });

    it('should skip suppliers when no changes are detected', async () => {
      const s = await service.create(
        { vendorNumber: 'BSUP-003', name: 'Bulk Sup 3', address1Country: 'AU' },
        'admin',
      );

      const res1 = await service.bulkUpdate(
        { ids: [s.vendorId], isPaymentBlocked: true },
        'admin',
      );
      expect(res1.updatedCount).toBe(1);

      const res2 = await service.bulkUpdate(
        { ids: [s.vendorId], isPaymentBlocked: true },
        'admin',
      );
      expect(res2).toEqual({ updatedCount: 0, skippedCount: 1 });
    });
  });
});
