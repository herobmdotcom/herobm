import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersWriteService } from './suppliers-write.service';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createMemoryDb } from '../../test/utils/memory-db';
import { suppliers, supplierEvents } from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

describe('SuppliersWriteService', () => {
  let service: SuppliersWriteService;
  let db: PgliteDatabase<any>;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersWriteService,
        { provide: DRIZZLE, useValue: db },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: jest.fn().mockReturnValue('EUR') },
        },
      ],
    }).compile();

    service = module.get<SuppliersWriteService>(SuppliersWriteService);

    // Clean transactional data
    await db.delete(supplierEvents);
    await db.delete(suppliers);
  });

  describe('create', () => {
    it('should create a supplier if vendor number is unique', async () => {
      const dto = { vendorNumber: 'V-001', name: 'Vendor 1' };
      const result = await service.create(dto, 'test-actor');
      expect(result.vendorNumber).toBe('V-001');

      const rows = await db
        .select()
        .from(suppliers)
        .where(eq(suppliers.vendorNumber, 'V-001'));
      expect(rows).toHaveLength(1);
    });

    it('should throw if vendor number already exists', async () => {
      await db.insert(suppliers).values({
        vendorNumber: 'V-001',
        name: 'Existing',
        currencyCode: 'EUR',
      });

      const dto = { vendorNumber: 'V-001', name: 'Duplicate' };
      await expect(service.create(dto, 'test-actor')).rejects.toThrow();
    });
  });

  describe('update', () => {
    let existingId: string;

    beforeEach(async () => {
      const [s] = await db
        .insert(suppliers)
        .values({
          vendorNumber: 'V-EX',
          name: 'Old Name',
          currencyCode: 'EUR',
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

      const [row] = await db
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
