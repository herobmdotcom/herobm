import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersService } from './suppliers.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { createMemoryDb } from '../../test/utils/memory-db';
import { suppliers } from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

describe('SuppliersService', () => {
  let service: SuppliersService;
  let db: PgliteDatabase<any>;

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [SuppliersService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<SuppliersService>(SuppliersService);

    await db.delete(suppliers);
  });

  describe('findAll', () => {
    it('should return paginated suppliers', async () => {
      await db.insert(suppliers).values([
        { vendorNumber: 'V1', name: 'Vendor 1', currencyCode: 'EUR' },
        { vendorNumber: 'V2', name: 'Vendor 2', currencyCode: 'USD' },
      ]);

      const result = await service.findAll();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('should apply search filter', async () => {
      await db.insert(suppliers).values([
        { vendorNumber: 'V1', name: 'Alpha', currencyCode: 'EUR' },
        { vendorNumber: 'V2', name: 'Beta', currencyCode: 'USD' },
      ]);

      const result = await service.findAll({ q: 'alpha' });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].name).toBe('Alpha');
    });
  });

  describe('findOne', () => {
    it('should return a single supplier', async () => {
      const [s] = await db.insert(suppliers).values({
        vendorNumber: 'V-EX',
        name: 'Existing Vendor',
        currencyCode: 'EUR',
      }).returning();

      const result = await service.findOne(s.vendorId);
      expect(result.name).toBe('Existing Vendor');
    });

    it('should throw NotFoundException if not found', async () => {
      await expect(service.findOne('00000000-0000-0000-0000-000000000999'))
        .rejects.toThrow(NotFoundException);
    });
  });
});
