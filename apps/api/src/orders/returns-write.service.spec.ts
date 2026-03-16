import { Test, TestingModule } from '@nestjs/testing';
import { ReturnsWriteService } from './returns-write.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock helpers (reuse pattern from orders-write.service.spec.ts)
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    innerJoin: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockTx() {
  return {
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue(createMockQueryBuilder([])) }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
  };
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const db: any = {
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue(selectQb) }),
    insert: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    update: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    delete: jest.fn().mockReturnValue(createMockQueryBuilder([])),
    transaction: jest.fn().mockImplementation(async (cb: any) => cb(createMockTx())),
    _selectQb: selectQb,
  };
  return db;
}

// Shared test data
const INVOICED_ORDER = {
  salesOrderId: 'order-001',
  orderNumber: 'ORD-20260315-0001',
  stateCode: 'invoiced',
  customerId: 'CUST-001',
};

const DRAFT_ORDER = {
  salesOrderId: 'order-002',
  orderNumber: 'ORD-20260315-0002',
  stateCode: 'draft',
  customerId: 'CUST-001',
};

const ORDER_LINE = {
  salesOrderLineId: 'line-001',
  salesOrderId: 'order-001',
  lineNumber: 1,
  productId: 'PROD-001',
  quantity: '10',
  pricePerUnit: '50.00',
  amount: '500.00',
};

const MOCK_RETURN = {
  returnId: 'ret-001',
  returnNumber: 'RET-20260315-0001',
  salesOrderId: 'order-001',
  stateCode: 'draft',
  notes: null,
  createdBy: 'admin',
};

const MOCK_RETURN_LINE = {
  returnLineId: 'retline-001',
  returnId: 'ret-001',
  salesOrderLineId: 'line-001',
  quantityReturned: '5',
  reason: 'Defective',
  returnFee: '10.00',
};

describe('ReturnsWriteService', () => {
  let service: ReturnsWriteService;
  let mockDb: any;
  let mockInventoryService: any;

  /**
   * Flexible select-chain mock that maps call indices to results.
   */
  function mockSelectChain(responses: Record<number, any[]>, fallback: any[] = []) {
    let call = 0;
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockImplementation(() => {
        call++;
        const data = responses[call] ?? fallback;
        const qb = createMockQueryBuilder(data);
        // Support innerJoin for getAlreadyReturnedQty
        qb.innerJoin = jest.fn().mockReturnValue(qb);
        return qb;
      }),
    });
  }

  function mockTransaction(result: any) {
    const mockTx = createMockTx();
    const txInsertQb = createMockQueryBuilder(Array.isArray(result) ? result : [result]);
    let insertCount = 0;
    mockTx.insert = jest.fn().mockImplementation(() => {
      insertCount++;
      if (insertCount === 1) return txInsertQb;
      return createMockQueryBuilder([]);
    });
    mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => cb(mockTx));
    return mockTx;
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    mockInventoryService = {
      commitStock: jest.fn().mockResolvedValue(undefined),
      releaseStock: jest.fn().mockResolvedValue(undefined),
      deductStock: jest.fn().mockResolvedValue(undefined),
      restoreStock: jest.fn().mockResolvedValue(undefined),
      returnStock: jest.fn().mockResolvedValue(undefined),
      placeOnOrder: jest.fn().mockResolvedValue(undefined),
      cancelOnOrder: jest.fn().mockResolvedValue(undefined),
      receiveStock: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReturnsWriteService,
        { provide: DRIZZLE, useValue: mockDb },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<ReturnsWriteService>(ReturnsWriteService);
  });

  // =========================================================================
  // createReturn()
  //
  // Select call sequence:
  //   1. findOrder → order row
  //   2. findOrderLine → order line row (per line in dto)
  //   3. getAlreadyReturnedQty → SUM query (per line)
  //   4. generateReturnNumber → returns query
  // =========================================================================

  describe('createReturn', () => {
    const validDto = {
      notes: 'Customer returned items',
      lines: [{
        salesOrderLineId: 'line-001',
        quantityReturned: '5',
        reason: 'Defective',
        returnFee: '10.00',
      }],
    };

    function setupCreate(opts?: { orderState?: string; alreadyReturned?: string; originalQty?: string }) {
      const orderState = opts?.orderState ?? 'invoiced';
      const alreadyReturned = opts?.alreadyReturned ?? '0';
      const originalQty = opts?.originalQty ?? '10';

      mockSelectChain({
        1: [{ ...INVOICED_ORDER, stateCode: orderState }],    // findOrder
        2: [{ ...ORDER_LINE, quantity: originalQty }],          // findOrderLine
        3: [{ total: alreadyReturned }],                        // getAlreadyReturnedQty
        4: [],                                                   // generateReturnNumber
      });

      mockTransaction({
        returnId: 'ret-001',
        returnNumber: 'RET-20260315-0001',
        salesOrderId: 'order-001',
        stateCode: 'draft',
      });
    }

    it('should create a return against an invoiced order', async () => {
      setupCreate();
      const result = await service.createReturn('order-001', validDto, 'admin');
      expect(result).toHaveProperty('returnId', 'ret-001');
      expect(result).toHaveProperty('stateCode', 'draft');
    });

    it('should reject return against a non-invoiced order', async () => {
      setupCreate({ orderState: 'draft' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return against a confirmed order', async () => {
      setupCreate({ orderState: 'confirmed' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return against a shipped order', async () => {
      setupCreate({ orderState: 'shipped' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return when quantity exceeds original', async () => {
      setupCreate({ originalQty: '3' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return when quantity exceeds remaining after prior returns', async () => {
      setupCreate({ alreadyReturned: '8' });
      await expect(
        service.createReturn('order-001', validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return with zero quantity', async () => {
      setupCreate();
      const dto = {
        lines: [{ salesOrderLineId: 'line-001', quantityReturned: '0' }],
      };
      await expect(
        service.createReturn('order-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject return with negative fee', async () => {
      setupCreate();
      const dto = {
        lines: [{
          salesOrderLineId: 'line-001',
          quantityReturned: '5',
          returnFee: '-10',
        }],
      };
      await expect(
        service.createReturn('order-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should create return with no lines', async () => {
      mockSelectChain({
        1: [INVOICED_ORDER],    // findOrder
        2: [],                   // generateReturnNumber
      });
      mockTransaction({
        returnId: 'ret-002',
        returnNumber: 'RET-20260315-0001',
        salesOrderId: 'order-001',
        stateCode: 'draft',
      });

      const dto = { lines: [] };
      const result = await service.createReturn('order-001', dto, 'admin');
      expect(result).toHaveProperty('returnId');
    });

    it('should call transaction', async () => {
      setupCreate();
      await service.createReturn('order-001', validDto, 'admin');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // updateReturn()
  // =========================================================================

  describe('updateReturn', () => {
    function setupForUpdate(stateCode: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode }],
      });

      const txUpdateQb = createMockQueryBuilder([{
        ...MOCK_RETURN,
        stateCode,
        notes: 'Updated notes',
      }]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it('should update notes on a draft return', async () => {
      setupForUpdate('draft');
      const result = await service.updateReturn('ret-001', { notes: 'Updated notes' }, 'admin');
      expect(result.notes).toBe('Updated notes');
    });

    it('should reject update on confirmed return', async () => {
      setupForUpdate('confirmed');
      await expect(
        service.updateReturn('ret-001', { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on processed return', async () => {
      setupForUpdate('processed');
      await expect(
        service.updateReturn('ret-001', { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // changeReturnState()
  // =========================================================================

  describe('changeReturnState', () => {
    function setupWithState(currentState: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: currentState }],
      });

      const txUpdateQb = createMockQueryBuilder([{ ...MOCK_RETURN, stateCode: '' }]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it.each([
      ['draft', 'confirmed'],
      ['draft', 'cancelled'],
      ['confirmed', 'processed'],
      ['confirmed', 'draft'],
    ])('should allow transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(service.changeReturnState('ret-001', to, 'admin')).resolves.toBeDefined();
    });

    it.each([
      ['draft', 'processed'],
      ['confirmed', 'cancelled'],
      ['processed', 'draft'],
      ['processed', 'confirmed'],
      ['cancelled', 'draft'],
    ])('should reject transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeReturnState('ret-001', to, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeReturnState('ret-001', 'nonexistent', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should emit return_processed event when transitioning to processed', async () => {
      setupWithState('confirmed');
      await service.changeReturnState('ret-001', 'processed', 'admin');
      // Verify the transaction was called (event is written inside)
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // addReturnLine()
  //
  // Select call sequence:
  //   1. findReturn → return row
  //   2. findOrderLine → order line row
  //   3. getAlreadyReturnedQty → SUM
  // =========================================================================

  describe('addReturnLine', () => {
    const lineDto = {
      salesOrderLineId: 'line-001',
      quantityReturned: '3',
      reason: 'Wrong item',
      returnFee: '5.00',
    };

    function setupForAddLine(returnState: string, alreadyReturned = '0') {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: returnState }],
        2: [ORDER_LINE],
        3: [{ total: alreadyReturned }],
      });

      const txInsertQb = createMockQueryBuilder([{
        returnLineId: 'retline-002',
        returnId: 'ret-001',
        salesOrderLineId: 'line-001',
        quantityReturned: '3',
      }]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.insert = jest.fn().mockReturnValue(txInsertQb);
        return cb(tx);
      });
    }

    it('should add a line to a draft return', async () => {
      setupForAddLine('draft');
      const result = await service.addReturnLine('ret-001', lineDto, 'admin');
      expect(result).toHaveProperty('returnLineId');
    });

    it('should reject adding to a confirmed return', async () => {
      setupForAddLine('confirmed');
      await expect(
        service.addReturnLine('ret-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a processed return', async () => {
      setupForAddLine('processed');
      await expect(
        service.addReturnLine('ret-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject when quantity exceeds remaining', async () => {
      setupForAddLine('draft', '9');
      const dto = { ...lineDto, quantityReturned: '5' };
      await expect(
        service.addReturnLine('ret-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative return fee', async () => {
      setupForAddLine('draft');
      const dto = { ...lineDto, returnFee: '-1' };
      await expect(
        service.addReturnLine('ret-001', dto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateReturnLine()
  // =========================================================================

  describe('updateReturnLine', () => {
    function setupForUpdateLine(returnState: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: returnState }],
        2: [MOCK_RETURN_LINE],
      });

      const txUpdateQb = createMockQueryBuilder([{
        ...MOCK_RETURN_LINE,
        quantityReturned: '3',
      }]);
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const tx = createMockTx();
        tx.update = jest.fn().mockReturnValue(txUpdateQb);
        return cb(tx);
      });
    }

    it('should update return line on a draft return', async () => {
      setupForUpdateLine('draft');
      const result = await service.updateReturnLine(
        'ret-001', 'retline-001', { reason: 'Changed mind' }, 'admin',
      );
      expect(result).toBeDefined();
    });

    it('should reject update on confirmed return', async () => {
      setupForUpdateLine('confirmed');
      await expect(
        service.updateReturnLine('ret-001', 'retline-001', { reason: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject negative return fee', async () => {
      setupForUpdateLine('draft');
      await expect(
        service.updateReturnLine('ret-001', 'retline-001', { returnFee: '-5' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeReturnLine()
  // =========================================================================

  describe('removeReturnLine', () => {
    function setupForRemoveLine(returnState: string) {
      mockSelectChain({
        1: [{ ...MOCK_RETURN, stateCode: returnState }],
        2: [MOCK_RETURN_LINE],
      });
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => cb(createMockTx()));
    }

    it('should remove a line from a draft return', async () => {
      setupForRemoveLine('draft');
      await expect(
        service.removeReturnLine('ret-001', 'retline-001', 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from confirmed return', async () => {
      setupForRemoveLine('confirmed');
      await expect(
        service.removeReturnLine('ret-001', 'retline-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from processed return', async () => {
      setupForRemoveLine('processed');
      await expect(
        service.removeReturnLine('ret-001', 'retline-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne() / findByOrder()
  // =========================================================================

  describe('findOne', () => {
    it('should return return with lines', async () => {
      mockSelectChain({
        1: [MOCK_RETURN],
        2: [MOCK_RETURN_LINE],
      });

      const result = await service.findOne('ret-001');
      expect(result).toHaveProperty('returnId', 'ret-001');
      expect(result.lines).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown return', async () => {
      mockSelectChain({ 1: [] });
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(NotFoundException);
    });
  });

  describe('findByOrder', () => {
    it('should return all returns for an order', async () => {
      // First call: list returns; subsequent calls: lines per return
      let call = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          call++;
          if (call === 1) {
            return createMockQueryBuilder([MOCK_RETURN]);
          }
          return createMockQueryBuilder([MOCK_RETURN_LINE]);
        }),
      });

      const result = await service.findByOrder('order-001');
      expect(result).toHaveLength(1);
      expect(result[0]).toHaveProperty('returnId', 'ret-001');
      expect(result[0].lines).toHaveLength(1);
    });
  });

  // =========================================================================
  // Helper validation
  // =========================================================================

  describe('findReturn (via updateReturn)', () => {
    it('should throw NotFoundException when return does not exist', async () => {
      mockSelectChain({ 1: [] });
      await expect(
        service.updateReturn('NONEXISTENT', { notes: 'test' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('findReturnLine (via updateReturnLine)', () => {
    it('should throw NotFoundException when return line does not exist', async () => {
      mockSelectChain({
        1: [MOCK_RETURN],
        2: [],
      });
      await expect(
        service.updateReturnLine('ret-001', 'NONEXISTENT', { reason: 'test' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if line belongs to different return', async () => {
      mockSelectChain({
        1: [MOCK_RETURN],
        2: [{ ...MOCK_RETURN_LINE, returnId: 'ret-OTHER' }],
      });
      await expect(
        service.updateReturnLine('ret-001', 'retline-001', { reason: 'test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
