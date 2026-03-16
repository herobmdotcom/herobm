import { Test, TestingModule } from '@nestjs/testing';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';

describe('OrdersController', () => {
  let controller: OrdersController;
  let readService: any;
  let writeService: any;
  let returnsService: any;

  const mockOrdersList = {
    data: [{ salesOrderId: 'uuid-1', orderNumber: 'ORD-001' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockOrder = {
    salesOrderId: 'uuid-1',
    orderNumber: 'ORD-001',
    customerId: 'C001',
    stateCode: 'draft',
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

  const mockReturn = {
    returnId: 'ret-uuid-1',
    returnNumber: 'RET-20260315-0001',
    salesOrderId: 'uuid-1',
    stateCode: 'draft',
    lines: [],
  };

  const mockReturnLine = {
    returnLineId: 'retline-uuid-1',
    returnId: 'ret-uuid-1',
    salesOrderLineId: 'line-uuid-1',
    quantityReturned: '5',
    reason: 'Defective',
    returnFee: '10.00',
  };

  const mockReq = { user: { username: 'admin' } };

  beforeEach(async () => {
    const mockReadService = {
      findAll: jest.fn().mockResolvedValue(mockOrdersList),
      findOne: jest.fn().mockResolvedValue(mockOrder),
      findAbmOrder: jest.fn().mockResolvedValue(mockOrder),
    };

    const mockWriteService = {
      findOne: jest.fn().mockResolvedValue(mockOrder),
      create: jest.fn().mockResolvedValue(mockOrder),
      update: jest.fn().mockResolvedValue(mockOrder),
      changeState: jest.fn().mockResolvedValue({ ...mockOrder, stateCode: 'quoted' }),
      addLine: jest.fn().mockResolvedValue(mockLine),
      updateLine: jest.fn().mockResolvedValue(mockLine),
      removeLine: jest.fn().mockResolvedValue(undefined),
    };

    const mockReturnsService = {
      createReturn: jest.fn().mockResolvedValue(mockReturn),
      findByOrder: jest.fn().mockResolvedValue([mockReturn]),
      findOne: jest.fn().mockResolvedValue(mockReturn),
      updateReturn: jest.fn().mockResolvedValue(mockReturn),
      changeReturnState: jest.fn().mockResolvedValue({ ...mockReturn, stateCode: 'confirmed' }),
      addReturnLine: jest.fn().mockResolvedValue(mockReturnLine),
      updateReturnLine: jest.fn().mockResolvedValue(mockReturnLine),
      removeReturnLine: jest.fn().mockResolvedValue(undefined),
    };

    const mockPickingService = {
      pickLine: jest.fn().mockResolvedValue(mockLine),
      pickAllForLine: jest.fn().mockResolvedValue(mockLine),
      pickAllOrder: jest.fn().mockResolvedValue({ shipmentId: 'ship-uuid-1' }),
      getPickingSummary: jest.fn().mockResolvedValue({ totalLines: 0, fullyPickedLines: 0, isFullyPicked: false, lines: [] }),
    };

    const mockShipmentService = {
      createShipment: jest.fn().mockResolvedValue({ shipmentId: 'ship-uuid-1' }),
      findByOrder: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({ shipmentId: 'ship-uuid-1', lines: [] }),
      updateShipment: jest.fn().mockResolvedValue({ shipmentId: 'ship-uuid-1' }),
      changeShipmentState: jest.fn().mockResolvedValue({ shipmentId: 'ship-uuid-1', stateCode: 'dispatched' }),
      addShipmentLine: jest.fn().mockResolvedValue({ shipmentLineId: 'sl-uuid-1' }),
      updateShipmentLine: jest.fn().mockResolvedValue({ shipmentLineId: 'sl-uuid-1' }),
      removeShipmentLine: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrdersController],
      providers: [
        { provide: OrdersService, useValue: mockReadService },
        { provide: OrdersWriteService, useValue: mockWriteService },
        { provide: ReturnsWriteService, useValue: mockReturnsService },
        { provide: PickingService, useValue: mockPickingService },
        { provide: ShipmentService, useValue: mockShipmentService },
      ],
    }).compile();

    controller = module.get<OrdersController>(OrdersController);
    readService = module.get(OrdersService);
    writeService = module.get(OrdersWriteService);
    returnsService = module.get(ReturnsWriteService);
  });

  // ---------------------------------------------------------------------------
  // Read endpoints
  // ---------------------------------------------------------------------------

  describe('findAll', () => {
    it('should call ordersService.findAll with no params', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockOrdersList);
      expect(readService.findAll).toHaveBeenCalledWith({
        search: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it('should parse pagination from query strings', async () => {
      await controller.findAll('test', '2', '25');
      expect(readService.findAll).toHaveBeenCalledWith({
        search: 'test',
        page: 2,
        limit: 25,
      });
    });
  });

  describe('findOne', () => {
    it('should route to ordersService.findOne with no source', async () => {
      const result = await controller.findOne('uuid-1');
      expect(result).toEqual(mockOrder);
      expect(readService.findOne).toHaveBeenCalledWith('uuid-1');
    });

    it('should route to writeService.findOne when source=app', async () => {
      await controller.findOne('uuid-1', 'app');
      expect(writeService.findOne).toHaveBeenCalledWith('uuid-1');
      expect(readService.findOne).not.toHaveBeenCalled();
    });

    it('should route to ordersService.findAbmOrder when source=abm', async () => {
      await controller.findOne('uuid-1', 'abm');
      expect(readService.findAbmOrder).toHaveBeenCalledWith('uuid-1');
      expect(writeService.findOne).not.toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Write endpoints
  // ---------------------------------------------------------------------------

  describe('create', () => {
    it('should call writeService.create with body and actor', async () => {
      const body = {
        customerId: 'C001',
        lines: [{ productId: 'P001', quantity: '5', pricePerUnit: '10.00' }],
      };
      const result = await controller.create(body, mockReq);
      expect(result).toEqual(mockOrder);
      expect(writeService.create).toHaveBeenCalledWith(body, 'admin');
    });
  });

  describe('update', () => {
    it('should call writeService.update with id, body, and actor', async () => {
      const body = { name: 'Updated Order', notes: 'Changed notes' };
      const result = await controller.update('uuid-1', body, mockReq);
      expect(result).toEqual(mockOrder);
      expect(writeService.update).toHaveBeenCalledWith('uuid-1', body, 'admin');
    });
  });

  describe('changeState', () => {
    it('should call writeService.changeState with id, stateCode, and actor', async () => {
      const result = await controller.changeState('uuid-1', 'quoted', mockReq);
      expect(result.stateCode).toBe('quoted');
      expect(writeService.changeState).toHaveBeenCalledWith('uuid-1', 'quoted', 'admin');
    });
  });

  describe('addLine', () => {
    it('should call writeService.addLine with orderId, body, and actor', async () => {
      const body = { productId: 'P001', quantity: '10', pricePerUnit: '25.00' };
      const result = await controller.addLine('uuid-1', body, mockReq);
      expect(result).toEqual(mockLine);
      expect(writeService.addLine).toHaveBeenCalledWith('uuid-1', body, 'admin');
    });
  });

  describe('updateLine', () => {
    it('should call writeService.updateLine with orderId, lineId, body, and actor', async () => {
      const body = { quantity: '20' };
      const result = await controller.updateLine('uuid-1', 'line-uuid-1', body, mockReq);
      expect(result).toEqual(mockLine);
      expect(writeService.updateLine).toHaveBeenCalledWith(
        'uuid-1', 'line-uuid-1', body, 'admin',
      );
    });
  });

  describe('removeLine', () => {
    it('should call writeService.removeLine with orderId, lineId, and actor', async () => {
      await controller.removeLine('uuid-1', 'line-uuid-1', mockReq);
      expect(writeService.removeLine).toHaveBeenCalledWith(
        'uuid-1', 'line-uuid-1', 'admin',
      );
    });
  });

  // ---------------------------------------------------------------------------
  // Returns endpoints
  // ---------------------------------------------------------------------------

  describe('createReturn', () => {
    it('should call returnsService.createReturn with orderId, body, and actor', async () => {
      const body = {
        lines: [{ salesOrderLineId: 'line-uuid-1', quantityReturned: '5', reason: 'Defective' }],
      };
      const result = await controller.createReturn('uuid-1', body, mockReq);
      expect(result).toEqual(mockReturn);
      expect(returnsService.createReturn).toHaveBeenCalledWith('uuid-1', body, 'admin');
    });
  });

  describe('findReturns', () => {
    it('should call returnsService.findByOrder with orderId', async () => {
      const result = await controller.findReturns('uuid-1');
      expect(result).toEqual([mockReturn]);
      expect(returnsService.findByOrder).toHaveBeenCalledWith('uuid-1');
    });
  });

  describe('findReturn', () => {
    it('should call returnsService.findOne with returnId', async () => {
      const result = await controller.findReturn('uuid-1', 'ret-uuid-1');
      expect(result).toEqual(mockReturn);
      expect(returnsService.findOne).toHaveBeenCalledWith('ret-uuid-1');
    });
  });

  describe('updateReturn', () => {
    it('should call returnsService.updateReturn with returnId, body, and actor', async () => {
      const body = { notes: 'Updated' };
      const result = await controller.updateReturn('uuid-1', 'ret-uuid-1', body, mockReq);
      expect(result).toEqual(mockReturn);
      expect(returnsService.updateReturn).toHaveBeenCalledWith('ret-uuid-1', body, 'admin');
    });
  });

  describe('changeReturnState', () => {
    it('should call returnsService.changeReturnState with returnId, stateCode, and actor', async () => {
      const result = await controller.changeReturnState('uuid-1', 'ret-uuid-1', 'confirmed', mockReq);
      expect(result.stateCode).toBe('confirmed');
      expect(returnsService.changeReturnState).toHaveBeenCalledWith('ret-uuid-1', 'confirmed', 'admin');
    });
  });

  describe('addReturnLine', () => {
    it('should call returnsService.addReturnLine with returnId, body, and actor', async () => {
      const body = { salesOrderLineId: 'line-uuid-1', quantityReturned: '3', reason: 'Wrong item' };
      const result = await controller.addReturnLine('uuid-1', 'ret-uuid-1', body, mockReq);
      expect(result).toEqual(mockReturnLine);
      expect(returnsService.addReturnLine).toHaveBeenCalledWith('ret-uuid-1', body, 'admin');
    });
  });

  describe('updateReturnLine', () => {
    it('should call returnsService.updateReturnLine', async () => {
      const body = { quantityReturned: '2' };
      const result = await controller.updateReturnLine('uuid-1', 'ret-uuid-1', 'retline-uuid-1', body, mockReq);
      expect(result).toEqual(mockReturnLine);
      expect(returnsService.updateReturnLine).toHaveBeenCalledWith(
        'ret-uuid-1', 'retline-uuid-1', body, 'admin',
      );
    });
  });

  describe('removeReturnLine', () => {
    it('should call returnsService.removeReturnLine', async () => {
      await controller.removeReturnLine('uuid-1', 'ret-uuid-1', 'retline-uuid-1', mockReq);
      expect(returnsService.removeReturnLine).toHaveBeenCalledWith(
        'ret-uuid-1', 'retline-uuid-1', 'admin',
      );
    });
  });
});
