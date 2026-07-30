import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersWriteService } from './suppliers-write.service';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { SUPPLIER_STATE } from '@herobm/shared';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { suppliers, masterDataEvents, actors } from '@herobm/db-schema';
import { eq } from 'drizzle-orm';

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
    await pg.db.delete(actors);
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
        .insert(actors)
        .values({
          name: 'Existing',
          headquartersAddressLine1: 'AU',
          isTaxRegistered: false,
        })
        .returning();

      await pg.db.insert(suppliers).values({
        actorId: act.actorId,
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
    let existingActorId: string;

    beforeEach(async () => {
      const [act] = await pg.db
        .insert(actors)
        .values({
          name: 'Old Name',
          headquartersAddressLine1: 'AU',
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
      existingActorId = act.actorId;
      existingId = s.vendorId;
    });

    it('should update an existing supplier', async () => {
      const result = await service.update(
        existingId,
        { name: 'New Name' },
        'test-actor',
      );
      const [updatedActor] = await pg.db
        .select()
        .from(actors)
        .where(eq(actors.actorId, existingActorId));
      expect(updatedActor.name).toBe('New Name');
    });

    it('should throw NotFoundException if supplier not found', async () => {
      const unknownId = '00000000-0000-4000-8000-000000000999';
      await expect(
        service.update(unknownId, { name: 'New' }, 'test-actor'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
