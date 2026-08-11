/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions are referenced in assertions without calling them */
import { AppConfigService } from '../settings/app-config.service';
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrderCreationService } from './order-creation.service';
import { OrderLinesService } from './order-lines.service';
import { OrderStateService } from './order-state.service';
import { OrdersCoreService } from './orders-core.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { OrdersQueryService } from './orders-query.service';
import { SALES_ORDER_STATE } from '@herobm/shared';
import { CreateOrderDto, ChangeOrderStateDto, CreateOrderLineDto } from './dto';

describe('OrdersController', () => {
  let controller: OrdersController;
  let readService: OrdersService;
  let orderCreationService: OrderCreationService;
  let orderLinesService: OrderLinesService;
  let orderStateService: OrderStateService;
  let ordersCoreService: OrdersCoreService;
  let documentDispatchService: DocumentDispatchService;
  let ordersQueryService: OrdersQueryService;

  const mockOrdersList = {
    data: [{ salesOrderId: 'uuid-1', orderNumber: 'ORD-001' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockOrder = {
    salesOrderId: 'uuid-1',
    orderNumber: 'ORD-001',
    customerId: '00000000-0000-4000-8000-000000000001',
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

  const mockUser = {
    userId: 'user-uuid-1',
    username: 'admin',
    role: 'admin',
    email: 'admin@example.com',
  };

  beforeEach(async () => {
    const mockReadService = {
      findAll: jest.fn().mockResolvedValue(mockOrdersList),
    };

    const mockCreationService = {
      create: jest.fn().mockResolvedValue(mockOrder),
      update: jest.fn().mockResolvedValue(mockOrder),
      updateLine: jest.fn().mockResolvedValue(mockLine),
      archive: jest.fn().mockResolvedValue(mockOrder),
      unarchive: jest.fn().mockResolvedValue(mockOrder),
    };

    const mockLinesService = {
      addLine: jest.fn().mockResolvedValue(mockLine),
      updateLine: jest.fn().mockResolvedValue(mockLine),
      removeLine: jest.fn().mockResolvedValue(undefined),
      addPostConfirmationLine: jest.fn().mockResolvedValue(mockLine),
    };

    const mockStateService = {
      changeSalesOrderState: jest.fn().mockResolvedValue({
        ...mockOrder,
        stateCode: SALES_ORDER_STATE.QUOTED,
      }),
      triggerTaxCalculation: jest.fn().mockResolvedValue(mockOrder),
      overrideCreditHold: jest.fn().mockResolvedValue(mockOrder),
    };

    const mockDocumentDispatchService = {
      emailDocument: jest.fn().mockResolvedValue({ success: true }),
    };

    const mockCoreService = {};

    const mockQueryService = {
      findOne: jest.fn().mockResolvedValue(mockOrder),
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
        { provide: OrderCreationService, useValue: mockCreationService },
        { provide: OrderLinesService, useValue: mockLinesService },
        { provide: OrderStateService, useValue: mockStateService },
        {
          provide: DocumentDispatchService,
          useValue: mockDocumentDispatchService,
        },
        { provide: OrdersCoreService, useValue: mockCoreService },
        { provide: OrdersQueryService, useValue: mockQueryService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    readService = module.get(OrdersService);
    orderCreationService = module.get(OrderCreationService);
    orderLinesService = module.get(OrderLinesService);
    orderStateService = module.get(OrderStateService);
    documentDispatchService = module.get(DocumentDispatchService);
    ordersCoreService = module.get(OrdersCoreService);
    ordersQueryService = module.get(OrdersQueryService);
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
    it('should route to ordersQueryService.findOne', async () => {
      const result = await controller.findOne('uuid-1');
      expect(result).toEqual(mockOrder);
      expect(ordersQueryService.findOne).toHaveBeenCalledWith('uuid-1');
    });
  });

  // ---------------------------------------------------------------------------
  // Write endpoints
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should call orderCreationService.create with body and actor', async () => {
      const body = {
        customerId: '00000000-0000-4000-8000-000000000001',
        lines: [{ productId: 'P001', quantity: '5', pricePerUnit: '10.00' }],
      };
      const result = await controller.create(body as CreateOrderDto, mockUser);
      expect(result).toEqual(mockOrder);
      expect(orderCreationService.create).toHaveBeenCalledWith(body, 'admin');
    });
  });

  describe('update', () => {
    it('should call orderCreationService.update with id, body, and actor', async () => {
      const body = { name: 'Updated Order', notes: 'Changed notes' };
      const result = await controller.update('uuid-1', body, mockUser);
      expect(result).toEqual(mockOrder);
      expect(orderCreationService.update).toHaveBeenCalledWith(
        'uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('emailDocument', () => {
    it('should queue the document for email using DocumentDispatchService', async () => {
      const dto = {
        emailAddress: 'customer@test.com',
        subject: 'Your Quote',
        body: 'Please find your quote attached.',
      };

      const result = await controller.emailDocument(
        mockOrder.salesOrderId,
        dto,
        mockUser,
      );
      expect(documentDispatchService.emailDocument).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });
  });
  describe('changeState', () => {
    it('should call writeService.changeState with id, stateCode, and actor', async () => {
      const result = await controller.changeState(
        'uuid-1',
        { stateCode: SALES_ORDER_STATE.QUOTED } as ChangeOrderStateDto,
        mockUser,
      );
      expect(result.stateCode).toBe(SALES_ORDER_STATE.QUOTED);
      expect(orderStateService.changeSalesOrderState).toHaveBeenCalledWith(
        'uuid-1',
        SALES_ORDER_STATE.QUOTED,
        'admin',
        undefined,
        undefined,
      );
    });
  });

  describe('addLine', () => {
    it('should call orderLinesService.addLine with orderId, body, and actor', async () => {
      const body = { productId: 'P001', quantity: '10', pricePerUnit: '25.00' };
      const result = await controller.addLine(
        'uuid-1',
        body as CreateOrderLineDto,
        mockUser,
      );
      expect(result).toEqual(mockLine);
      expect(orderLinesService.addLine).toHaveBeenCalledWith(
        'uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('updateLine', () => {
    it('should call orderLinesService.updateLine with orderId, lineId, body, and actor', async () => {
      const body = { quantity: '20' };
      const result = await controller.updateLine(
        'uuid-1',
        'line-uuid-1',
        body,
        mockUser,
      );
      expect(result).toEqual(mockLine);
      expect(orderLinesService.updateLine).toHaveBeenCalledWith(
        'uuid-1',
        'line-uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('removeLine', () => {
    it('should call orderLinesService.removeLine with orderId, lineId, and actor', async () => {
      await controller.removeLine('uuid-1', 'line-uuid-1', mockUser);
      expect(orderLinesService.removeLine).toHaveBeenCalledWith(
        'uuid-1',
        'line-uuid-1',
        'admin',
      );
    });
  });
});
