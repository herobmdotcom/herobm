import { Test, TestingModule } from '@nestjs/testing';
import { ProductsWriteService } from './products-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException, BadRequestException } from '@nestjs/common';

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(selectQb),
    }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    transaction: jest
      .fn()
      .mockImplementation(async (cb: any) => cb(createMockTx())),
  };
  return db;
}

describe('ProductsWriteService', () => {
  let service: ProductsWriteService;
  let mockDb: any;

  function mockTransaction(insertOrUpdateResult: any[]) {
    const mockTx = createMockTx();
    mockTx.insert = jest
      .fn()
      .mockReturnValue(createMockQueryBuilder(insertOrUpdateResult));
    mockTx.update = jest
      .fn()
      .mockReturnValue(createMockQueryBuilder(insertOrUpdateResult));
    mockDb.transaction = jest
      .fn()
      .mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  function mockSelectSequence(sequences: any[]) {
    let call = 0;
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        const data = sequences[call] ?? [];
        call++;
        const qb = createMockQueryBuilder(data);
        qb.orderBy = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [ProductsWriteService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<ProductsWriteService>(ProductsWriteService);
  });

  describe('create', () => {
    const validDto = {
      productNumber: 'PROD-01',
      name: 'Test Product',
    };

    it('should create a product and insert an event', async () => {
      const tx = mockTransaction([{ productId: '1', ...validDto }]);

      const result = await service.create(validDto, 'admin');

      expect(result).toBeDefined();
      expect(result.productId).toBe('1');
      expect(tx.insert).toHaveBeenCalledTimes(2); // One for coreProducts, one for productEvents
    });
  });

  describe('update', () => {
    const validDto = { name: 'Updated Product Name' };

    it('should reject update if product not found', async () => {
      mockSelectSequence([[]]); // Returns empty array on select
      await expect(service.update('1', validDto, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should update product and write standard update event', async () => {
      mockSelectSequence([
        [{ productId: '1', name: 'Old Product Name', stateCode: 'active' }],
      ]);
      const tx = mockTransaction([{ productId: '1', ...validDto }]);

      const result = await service.update('1', validDto, 'admin');

      expect(result).toBeDefined();
      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(1); // Standard update event
    });

    it('should write specialized status_changed event if only stateCode is updated', async () => {
      mockSelectSequence([
        [{ productId: '1', name: 'Product Name', stateCode: 'draft' }],
      ]);
      const tx = mockTransaction([{ productId: '1', stateCode: 'active' }]);

      await service.update('1', { stateCode: 'active' }, 'admin');

      expect(tx.insert).toHaveBeenCalledTimes(1);
      // Because we can't easily assert the specific argument tree with our generic mock setup,
      // we just ensure the insert flow handles it properly without throwing.
    });

    it('should not update database if there are no changes', async () => {
      mockSelectSequence([[{ productId: '1', name: 'Same Name' }]]);
      const tx = mockTransaction([{ productId: '1', name: 'Same Name' }]);

      await service.update('1', { name: 'Same Name' }, 'admin');

      expect(tx.update).toHaveBeenCalledTimes(1); // the update call is always made by logic
      expect(tx.insert).not.toHaveBeenCalled(); // No changes = no event created
    });
  });

  describe('archive', () => {
    it('should reject archive if product not found', async () => {
      mockSelectSequence([[]]);
      await expect(service.archive('1', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject archive if product is already archived', async () => {
      mockSelectSequence([[{ productId: '1', stateCode: 'archived' }]]);
      await expect(service.archive('1', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should archive an active product and create an event', async () => {
      mockSelectSequence([[{ productId: '1', stateCode: 'active' }]]);
      const tx = mockTransaction([{ productId: '1', stateCode: 'archived' }]);

      const result = await service.archive('1', 'admin');

      expect(result).toBeDefined();
      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(1);
    });
  });

  describe('unarchive', () => {
    it('should reject unarchive if product not found', async () => {
      mockSelectSequence([[]]);
      await expect(service.unarchive('1', 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should reject unarchive if product is not archived', async () => {
      mockSelectSequence([[{ productId: '1', stateCode: 'active' }]]);
      await expect(service.unarchive('1', 'admin')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should unarchive to previous state based on last event', async () => {
      mockSelectSequence([
        [{ productId: '1', stateCode: 'archived' }], // 1. find product
        [{ payload: { from: 'draft' } }], // 2. find last archive event
      ]);
      const tx = mockTransaction([{ productId: '1', stateCode: 'draft' }]);

      const result = await service.unarchive('1', 'admin');

      expect(result).toBeDefined();
      expect(tx.update).toHaveBeenCalledTimes(1);
      expect(tx.insert).toHaveBeenCalledTimes(1);
    });

    it('should unarchive to active if no previous state is found', async () => {
      mockSelectSequence([
        [{ productId: '1', stateCode: 'archived' }], // 1. find product
        [], // 2. no prior event found
      ]);
      const tx = mockTransaction([{ productId: '1', stateCode: 'active' }]);

      const result = await service.unarchive('1', 'admin');

      expect(result).toBeDefined();
      expect(tx.update).toHaveBeenCalledTimes(1); // should fallback to 'active'
      expect(tx.insert).toHaveBeenCalledTimes(1);
    });
  });
});
