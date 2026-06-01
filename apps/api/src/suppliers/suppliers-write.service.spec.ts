import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersWriteService } from './suppliers-write.service';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { setupPgliteSuite } from '../test-utils/pglite-suite';
import { suppliers, supplierEvents } from '../drizzle/modbm-core-schema';
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
      ],
    }).compile();

    service = module.get<SuppliersWriteService>(SuppliersWriteService);

    // Clean transactional data
    await pg.db.delete(supplierEvents);
    await pg.db.delete(suppliers);
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
      await pg.db.insert(suppliers).values({
        vendorNumber: 'V-001',
        name: 'Existing',
        currencyCode: 'EUR',
        address1Country: 'AU',
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

    beforeEach(async () => {
      const [s] = await pg.db
        .insert(suppliers)
        .values({
          vendorNumber: 'V-EX',
          name: 'Old Name',
          currencyCode: 'EUR',
          address1Country: 'AU',
        })
        .returning();
      existingId = s.vendorId;
    });

    it('should update an existing supplier', async () => {
      const result = await service.update(
        existingId,
        { name: 'New Name' },
        'test-actor',
      );
      expect(result.name).toBe('New Name');

      const [row] = await pg.db
        .select()
        .from(suppliers)
        .where(eq(suppliers.vendorId, existingId));
      expect(row.name).toBe('New Name');
    });

    it('should throw NotFoundException if supplier not found', async () => {
      const unknownId = '00000000-0000-0000-0000-000000000999';
      await expect(
        service.update(unknownId, { name: 'New' }, 'test-actor'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
