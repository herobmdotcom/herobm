import { Test, TestingModule } from '@nestjs/testing';
import { TaxCategoriesService } from './tax-categories.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';
import { createMemoryDb } from '../../test/utils/memory-db';
import { taxCategories } from '../drizzle/modbm-core-schema';
import { PgliteDatabase } from 'drizzle-orm/pglite';
import { eq } from 'drizzle-orm';

describe('TaxCategoriesService', () => {
  let service: TaxCategoriesService;
  let db: PgliteDatabase<any>;

  const mockCategories = [
    {
      taxCategoryId: '550e8400-e29b-41d4-a716-446655440000',
      code: 'GST',
      title: 'GST 10%',
      type: 'tax_applies',
      rate: '10',
      isDefault: true,
    },
    {
      taxCategoryId: '550e8400-e29b-41d4-a716-446655440001',
      code: 'EXE',
      title: 'Exempt',
      type: 'exempt',
      rate: '0',
      isDefault: false,
    },
    {
      taxCategoryId: '550e8400-e29b-41d4-a716-446655440002',
      code: 'ZRO',
      title: 'Zero Rated',
      type: 'zero_rated',
      rate: '0',
      isDefault: false,
    },
  ];

  beforeAll(async () => {
    const mem = await createMemoryDb({ skipSeeds: true });
    db = mem.db;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [TaxCategoriesService, { provide: DRIZZLE, useValue: db }],
    }).compile();

    service = module.get<TaxCategoriesService>(TaxCategoriesService);

    await db.delete(taxCategories);
    await db.insert(taxCategories).values(mockCategories);
  });

  describe('findAll', () => {
    it('should return all tax categories', async () => {
      const result = await service.findAll();
      expect(result).toHaveLength(3);
      expect(result.map(c => c.code).sort()).toEqual(['EXE', 'GST', 'ZRO']);
    });
  });

  describe('getById', () => {
    it('should return a category by ID', async () => {
      const targetId = '550e8400-e29b-41d4-a716-446655440000';
      const result = await service.getById(targetId);
      expect(result.code).toBe('GST');
    });

    it('should throw NotFoundException for unknown ID', async () => {
      const unknownId = '550e8400-e29b-41d4-a716-446655440999';
      await expect(service.getById(unknownId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('getDefault', () => {
    it('should return the default category', async () => {
      const result = await service.getDefault();
      expect(result.code).toBe('GST');
      expect(result.isDefault).toBe(true);
    });

    it('should throw NotFoundException when no default configured', async () => {
      await db.update(taxCategories).set({ isDefault: false });
      await expect(service.getDefault()).rejects.toThrow(NotFoundException);
    });
  });

  describe('getByCode', () => {
    it('should return a category by code', async () => {
      const result = await service.getByCode('EXE');
      expect(result.code).toBe('EXE');
    });

    it('should throw NotFoundException for unknown code', async () => {
      await expect(service.getByCode('INVALID')).rejects.toThrow(NotFoundException);
    });
  });
});
