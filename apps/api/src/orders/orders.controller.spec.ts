import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { SALES_ORDER_STATE } from '@modbm/shared';

describe('OrdersController', () => {
  let controller: OrdersController;
  let readService: any;
  let writeService: any;

  const mockOrdersList = {
    data: [{ salesOrderId: 'uuid-1', orderNumber: 'ORD-001' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockOrder = {
    salesOrderId: 'uuid-1',
    orderNumber: 'ORD-001',
    customerId: 'c0000000-0000-0000-0000-000000000001',
    stateCode: SALES_ORDER_STATE.DRAFT,
    lines: [],
    events: [],
  };

  const mockLine = {
    salesOrderLineId: 'line-uuid-1',
    lineNumber: 1,
    productId: 'P001',
    quantity: '10',
    pricePerUnit: '25.00',
  };

  const mockUser = { userId: 'user-uuid-1', username: 'admin', role: 'admin' };

  beforeEach(async () => {
    const mockReadService = {
      findAll: jest.fn().mockResolvedValue(mockOrdersList),
    };

    const mockWriteService = {
      findOne: jest.fn().mockResolvedValue(mockOrder),
      create: jest.fn().mockResolvedValue(mockOrder),
      update: jest.fn().mockResolvedValue(mockOrder),
      changeSalesOrderState: jest.fn().mockResolvedValue({
        ...mockOrder,
        stateCode: SALES_ORDER_STATE.QUOTED,
      }),
      addLine: jest.fn().mockResolvedValue(mockLine),
      updateLine: jest.fn().mockResolvedValue(mockLine),
      removeLine: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        {
          provide: AppConfigService,
          useValue: {
            defaultFulfillmentLocationId: jest.fn().mockReturnValue('MAIN'),
          },
        },
        { provide: OrdersService, useValue: mockReadService },
        { provide: OrdersWriteService, useValue: mockWriteService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    readService = module.get(OrdersService);
    writeService = module.get(OrdersWriteService);
  });

  // ---------------------------------------------------------------------------
  // Read endpoints
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('should call ordersService.findAll with empty query', async () => {
      const result = await controller.findAll({});
      expect(result).toEqual(mockOrdersList);
      expect(readService.findAll).toHaveBeenCalledWith({});
    });

    it('should pass pagination query through to service', async () => {
      const query = { q: 'test', page: 2, limit: 25 };
      await controller.findAll(query);
      expect(readService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should route to writeService.findOne', async () => {
      const result = await controller.findOne('uuid-1');
      expect(result).toEqual(mockOrder);
      expect(writeService.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Write endpoints
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should call writeService.create with body and actor', async () => {
      const body = {
        customerId: 'c0000000-0000-0000-0000-000000000001',
        lines: [{ productId: 'P001', quantity: '5', pricePerUnit: '10.00' }],
      };
      const result = await controller.create(body as any, mockUser);
      expect(result).toEqual(mockOrder);
      expect(writeService.create).toHaveBeenCalledWith(body, 'admin');
    });
  });

  describe('update', () => {
    it('should call writeService.update with id, body, and actor', async () => {
      const body = { name: 'Updated Order', notes: 'Changed notes' };
      const result = await controller.update('uuid-1', body, mockUser);
      expect(result).toEqual(mockOrder);
      expect(writeService.update).toHaveBeenCalledWith('uuid-1', body, 'admin');
    });
  });

  describe('changeState', () => {
    it('should call writeService.changeState with id, stateCode, and actor', async () => {
      const result = await controller.changeState(
        'uuid-1',
        SALES_ORDER_STATE.QUOTED,
        mockUser,
      );
      expect(result.stateCode).toBe(SALES_ORDER_STATE.QUOTED);
      expect(writeService.changeSalesOrderState).toHaveBeenCalledWith(
        'uuid-1',
        SALES_ORDER_STATE.QUOTED,
        'admin',
        undefined,
        undefined,
      );
    });
  });

  describe('addLine', () => {
    it('should call writeService.addLine with orderId, body, and actor', async () => {
      const body = { productId: 'P001', quantity: '10', pricePerUnit: '25.00' };
      const result = await controller.addLine('uuid-1', body as any, mockUser);
      expect(result).toEqual(mockLine);
      expect(writeService.addLine).toHaveBeenCalledWith(
        'uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('updateLine', () => {
    it('should call writeService.updateLine with orderId, lineId, body, and actor', async () => {
      const body = { quantity: '20' };
      const result = await controller.updateLine(
        'uuid-1',
        'line-uuid-1',
        body,
        mockUser,
      );
      expect(result).toEqual(mockLine);
      expect(writeService.updateLine).toHaveBeenCalledWith(
        'uuid-1',
        'line-uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('removeLine', () => {
    it('should call writeService.removeLine with orderId, lineId, and actor', async () => {
      await controller.removeLine('uuid-1', 'line-uuid-1', mockUser);
      expect(writeService.removeLine).toHaveBeenCalledWith(
        'uuid-1',
        'line-uuid-1',
        'admin',
      );
    });
  });
});
