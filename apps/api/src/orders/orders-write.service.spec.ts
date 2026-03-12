import { Test, TestingModule } from '@nestjs/testing';
import { OrdersWriteService } from './orders-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';

// ---------------------------------------------------------------------------
// Mock Drizzle DB
//
// The write service uses Drizzle's query builder (select/insert/update/delete)
// and transactions. We mock the chainable API with jest functions that return
// `this` for chaining, and provide a `transaction` implementation that passes
// a mock tx object to the callback.
// ---------------------------------------------------------------------------

function createMockQueryBuilder(resolvedValue: any = []) {
  const qb: any = {
    values: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue(resolvedValue),
    // For select() without returning(), the final chain resolves via await
    then: jest.fn().mockImplementation((cb) => cb(resolvedValue)),
  };
  return qb;
}

function createMockDb() {
  const selectQb = createMockQueryBuilder([]);
  const insertQb = createMockQueryBuilder([]);
  const updateQb = createMockQueryBuilder([]);
  const deleteQb = createMockQueryBuilder([]);

  const db: any = {
    select: jest.fn().mockReturnValue({ from: jest.fn().mockReturnValue(selectQb) }),
    insert: jest.fn().mockReturnValue(insertQb),
    update: jest.fn().mockReturnValue(updateQb),
    delete: jest.fn().mockReturnValue(deleteQb),
    transaction: jest.fn().mockImplementation(async (cb: any) => {
      // tx mirrors the db shape
      const txInsertQb = createMockQueryBuilder([]);
      const txUpdateQb = createMockQueryBuilder([]);
      const txDeleteQb = createMockQueryBuilder([]);
      const tx = {
        insert: jest.fn().mockReturnValue(txInsertQb),
        update: jest.fn().mockReturnValue(txUpdateQb),
        delete: jest.fn().mockReturnValue(txDeleteQb),
      };
      return cb(tx);
    }),
    // Expose inner mocks for assertions
    _selectQb: selectQb,
    _insertQb: insertQb,
    _updateQb: updateQb,
    _deleteQb: deleteQb,
  };
  return db;
}


describe('OrdersWriteService', () => {
  let service: OrdersWriteService;
  let mockDb: any;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockDb = createMockDb();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersWriteService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<OrdersWriteService>(OrdersWriteService);
  });

  // =========================================================================
  // computeLineAmount (via create / addLine)
  // =========================================================================

  describe('line amount computation', () => {
    // Access the private method via any-cast for direct testing
    const computeLineAmount = (
      qty: string,
      price: string,
      disc: string,
      tax: string,
    ) => {
      return (OrdersWriteService.prototype as any).computeLineAmount.call(
        null,
        qty,
        price,
        disc,
        tax,
      );
    };

    it('should compute amount without discount', () => {
      const result = computeLineAmount('10', '5.00', '0', '0');
      expect(result.amount).toBe('50.00');
      expect(result.totalAmount).toBe('50.00');
    });

    it('should apply percentage discount', () => {
      const result = computeLineAmount('10', '5.00', '10', '0');
      expect(result.amount).toBe('45.00');
      expect(result.totalAmount).toBe('45.00');
    });

    it('should add tax to total', () => {
      const result = computeLineAmount('10', '5.00', '0', '5.00');
      expect(result.amount).toBe('50.00');
      expect(result.totalAmount).toBe('55.00');
    });

    it('should handle discount and tax together', () => {
      const result = computeLineAmount('10', '5.00', '10', '4.50');
      expect(result.amount).toBe('45.00');
      expect(result.totalAmount).toBe('49.50');
    });

    it('should handle fractional quantities', () => {
      const result = computeLineAmount('2.5', '10.00', '0', '0');
      expect(result.amount).toBe('25.00');
    });
  });

  // =========================================================================
  // create()
  // =========================================================================

  describe('create', () => {
    const validDto = {
      customerId: 'CUST-001',
      lines: [
        {
          productId: 'PROD-001',
          quantity: '10',
          pricePerUnit: '5.00',
        },
      ],
    };

    beforeEach(() => {
      // resolveCustomer: return a row with discount
      const customerSelectQb = createMockQueryBuilder([{ id: 'CUST-001', customerDiscount: '15' }]);
      // validateProduct: return a row so it passes
      const productSelectQb = createMockQueryBuilder([{ id: 'PROD-001' }]);
      // generateOrderNumber: return empty (no existing orders today)
      const orderNumSelectQb = createMockQueryBuilder([]);

      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return customerSelectQb; // resolveCustomer
          if (selectCallCount === 2) return productSelectQb;  // validateProduct
          return orderNumSelectQb;                             // generateOrderNumber
        }),
      });

      // Transaction should return the created order
      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const txInsertQb = createMockQueryBuilder([{
          salesOrderId: 'uuid-001',
          orderNumber: 'ORD-20260312-0001',
          stateCode: 'draft',
          customerDiscount: '15',
        }]);
        const txUpdateQb = createMockQueryBuilder([]);
        const tx = {
          insert: jest.fn().mockReturnValue(txInsertQb),
          update: jest.fn().mockReturnValue(txUpdateQb),
        };
        return cb(tx);
      });
    });

    it('should create an order in draft state', async () => {
      const result = await service.create(validDto, 'admin');
      expect(result).toHaveProperty('salesOrderId', 'uuid-001');
      expect(result).toHaveProperty('stateCode', 'draft');
    });

    it('should call transaction', async () => {
      await service.create(validDto, 'admin');
      expect(mockDb.transaction).toHaveBeenCalledTimes(1);
    });

    it('should reject unknown customer', async () => {
      // Override resolveCustomer to return no rows
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(createMockQueryBuilder([])),
      });

      await expect(
        service.create({ ...validDto, customerId: 'NONEXISTENT' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown product', async () => {
      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) return createMockQueryBuilder([{ id: 'CUST-001', customerDiscount: '0' }]);
          return createMockQueryBuilder([]); // product not found
        }),
      });

      await expect(
        service.create(validDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // update()
  // =========================================================================

  describe('update', () => {
    it('should update header fields on a draft order', async () => {
      // findOrder returns a draft order
      const findOrderQb = createMockQueryBuilder([{
        salesOrderId: 'uuid-001',
        stateCode: 'draft',
        name: 'Old Name',
        customerOrderNumber: null,
        notes: null,
      }]);
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(findOrderQb),
      });

      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const txUpdateQb = createMockQueryBuilder([{
          salesOrderId: 'uuid-001',
          name: 'New Name',
          stateCode: 'draft',
        }]);
        const txInsertQb = createMockQueryBuilder([]);
        const tx = {
          update: jest.fn().mockReturnValue(txUpdateQb),
          insert: jest.fn().mockReturnValue(txInsertQb),
        };
        return cb(tx);
      });

      const result = await service.update('uuid-001', { name: 'New Name' }, 'admin');
      expect(result.name).toBe('New Name');
    });

    it('should reject update on invoiced order', async () => {
      const findOrderQb = createMockQueryBuilder([{
        salesOrderId: 'uuid-001',
        stateCode: 'invoiced',
      }]);
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(findOrderQb),
      });

      await expect(
        service.update('uuid-001', { name: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on cancelled order', async () => {
      const findOrderQb = createMockQueryBuilder([{
        salesOrderId: 'uuid-001',
        stateCode: 'cancelled',
      }]);
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(findOrderQb),
      });

      await expect(
        service.update('uuid-001', { notes: 'Test' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // changeState()
  // =========================================================================

  describe('changeState', () => {
    function setupWithState(currentState: string) {
      const findOrderQb = createMockQueryBuilder([{
        salesOrderId: 'uuid-001',
        stateCode: currentState,
      }]);
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(findOrderQb),
      });

      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const txUpdateQb = createMockQueryBuilder([{
          salesOrderId: 'uuid-001',
          stateCode: '', // will be overridden
        }]);
        const txInsertQb = createMockQueryBuilder([]);
        const tx = {
          update: jest.fn().mockReturnValue(txUpdateQb),
          insert: jest.fn().mockReturnValue(txInsertQb),
        };
        return cb(tx);
      });
    }

    // Valid transitions
    it.each([
      ['draft', 'quoted'],
      ['draft', 'cancelled'],
      ['quoted', 'confirmed'],
      ['quoted', 'draft'],
      ['quoted', 'cancelled'],
      ['confirmed', 'picking'],
      ['confirmed', 'cancelled'],
      ['picking', 'shipped'],
      ['picking', 'confirmed'],
      ['shipped', 'invoiced'],
      ['cancelled', 'draft'],
    ])('should allow transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(service.changeState('uuid-001', to, 'admin')).resolves.toBeDefined();
    });

    // Invalid transitions
    it.each([
      ['draft', 'shipped'],
      ['draft', 'invoiced'],
      ['draft', 'picking'],
      ['draft', 'confirmed'],
      ['confirmed', 'quoted'],
      ['shipped', 'draft'],
      ['invoiced', 'draft'],
      ['invoiced', 'cancelled'],
    ])('should reject transition %s → %s', async (from, to) => {
      setupWithState(from);
      await expect(
        service.changeState('uuid-001', to, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject unknown state name', async () => {
      await expect(
        service.changeState('uuid-001', 'nonexistent_state', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // addLine()
  // =========================================================================

  describe('addLine', () => {
    const lineDto = {
      productId: 'PROD-001',
      quantity: '5',
      pricePerUnit: '12.00',
    };

    function setupForAddLine(orderState: string, maxLineNumber: number = 0) {
      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // findOrder
            return createMockQueryBuilder([{
              salesOrderId: 'uuid-001',
              stateCode: orderState,
            }]);
          }
          if (selectCallCount === 2) {
            // validateProduct
            return createMockQueryBuilder([{ id: 'PROD-001' }]);
          }
          // max line number query
          return createMockQueryBuilder([{ max: maxLineNumber }]);
        }),
      });

      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const txInsertQb = createMockQueryBuilder([{
          salesOrderLineId: 'line-uuid-001',
          lineNumber: maxLineNumber + 1,
        }]);
        const txUpdateQb = createMockQueryBuilder([]);
        const tx = {
          insert: jest.fn().mockReturnValue(txInsertQb),
          update: jest.fn().mockReturnValue(txUpdateQb),
        };
        return cb(tx);
      });
    }

    it('should add a line to a draft order', async () => {
      setupForAddLine('draft', 2);
      const result = await service.addLine('uuid-001', lineDto, 'admin');
      expect(result).toHaveProperty('salesOrderLineId');
      expect(result.lineNumber).toBe(3);
    });

    it('should reject adding to an invoiced order', async () => {
      setupForAddLine('invoiced');
      await expect(
        service.addLine('uuid-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a shipped order', async () => {
      setupForAddLine('shipped');
      await expect(
        service.addLine('uuid-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject adding to a cancelled order', async () => {
      setupForAddLine('cancelled');
      await expect(
        service.addLine('uuid-001', lineDto, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // updateLine()
  // =========================================================================

  describe('updateLine', () => {
    function setupForUpdateLine(orderState: string) {
      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            // findOrder
            return createMockQueryBuilder([{
              salesOrderId: 'uuid-001',
              stateCode: orderState,
            }]);
          }
          // findLine
          return createMockQueryBuilder([{
            salesOrderLineId: 'line-001',
            salesOrderId: 'uuid-001',
            quantity: '10',
            pricePerUnit: '5.00',
            discountPercentage: '0',
            tax: '0',
          }]);
        }),
      });

      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const txUpdateQb = createMockQueryBuilder([{
          salesOrderLineId: 'line-001',
          quantity: '20',
          amount: '100.00',
          totalAmount: '100.00',
        }]);
        const txInsertQb = createMockQueryBuilder([]);
        const tx = {
          update: jest.fn().mockReturnValue(txUpdateQb),
          insert: jest.fn().mockReturnValue(txInsertQb),
        };
        return cb(tx);
      });
    }

    it('should update line quantity on a draft order', async () => {
      setupForUpdateLine('draft');
      const result = await service.updateLine(
        'uuid-001', 'line-001', { quantity: '20' }, 'admin',
      );
      expect(result).toHaveProperty('salesOrderLineId', 'line-001');
    });

    it('should reject update on invoiced order', async () => {
      setupForUpdateLine('invoiced');
      await expect(
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject update on shipped order', async () => {
      setupForUpdateLine('shipped');
      await expect(
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // removeLine()
  // =========================================================================

  describe('removeLine', () => {
    function setupForRemoveLine(orderState: string) {
      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createMockQueryBuilder([{
              salesOrderId: 'uuid-001',
              stateCode: orderState,
            }]);
          }
          return createMockQueryBuilder([{
            salesOrderLineId: 'line-001',
            salesOrderId: 'uuid-001',
            productId: 'PROD-001',
            quantity: '10',
          }]);
        }),
      });

      mockDb.transaction = jest.fn().mockImplementation(async (cb: any) => {
        const txDeleteQb = createMockQueryBuilder([]);
        const txUpdateQb = createMockQueryBuilder([]);
        const txInsertQb = createMockQueryBuilder([]);
        const tx = {
          delete: jest.fn().mockReturnValue(txDeleteQb),
          update: jest.fn().mockReturnValue(txUpdateQb),
          insert: jest.fn().mockReturnValue(txInsertQb),
        };
        return cb(tx);
      });
    }

    it('should remove a line from a draft order', async () => {
      setupForRemoveLine('draft');
      await expect(
        service.removeLine('uuid-001', 'line-001', 'admin'),
      ).resolves.toBeUndefined();
    });

    it('should reject removal from invoiced order', async () => {
      setupForRemoveLine('invoiced');
      await expect(
        service.removeLine('uuid-001', 'line-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject removal from cancelled order', async () => {
      setupForRemoveLine('cancelled');
      await expect(
        service.removeLine('uuid-001', 'line-001', 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // =========================================================================
  // findOne() / findOrder() / findLine()
  // =========================================================================

  describe('findOne', () => {
    it('should return order with lines and events', async () => {
      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          const qb = createMockQueryBuilder([]);
          if (selectCallCount === 1) {
            // findOrder
            qb.then = jest.fn().mockImplementation((cb) =>
              cb([{ salesOrderId: 'uuid-001', stateCode: 'draft' }]),
            );
          } else if (selectCallCount === 2) {
            // lines
            qb.then = jest.fn().mockImplementation((cb) =>
              cb([{ salesOrderLineId: 'line-001', lineNumber: 1 }]),
            );
          } else {
            // events
            qb.then = jest.fn().mockImplementation((cb) =>
              cb([{ eventId: 'evt-001', eventType: 'created' }]),
            );
          }
          return qb;
        }),
      });

      const result = await service.findOne('uuid-001');
      expect(result).toHaveProperty('salesOrderId', 'uuid-001');
      expect(result).toHaveProperty('lines');
      expect(result).toHaveProperty('events');
      expect(result.lines).toHaveLength(1);
      expect(result.events).toHaveLength(1);
    });

    it('should throw NotFoundException for unknown order', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue(createMockQueryBuilder([])),
      });

      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findLine (via updateLine)', () => {
    it('should throw BadRequestException if line belongs to different order', async () => {
      let selectCallCount = 0;
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockImplementation(() => {
          selectCallCount++;
          if (selectCallCount === 1) {
            return createMockQueryBuilder([{
              salesOrderId: 'uuid-001',
              stateCode: 'draft',
            }]);
          }
          // Line belongs to a different order
          return createMockQueryBuilder([{
            salesOrderLineId: 'line-001',
            salesOrderId: 'uuid-OTHER',
            quantity: '10',
            pricePerUnit: '5.00',
          }]);
        }),
      });

      await expect(
        service.updateLine('uuid-001', 'line-001', { quantity: '20' }, 'admin'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
