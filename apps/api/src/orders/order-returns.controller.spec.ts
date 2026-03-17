import { Test, TestingModule } from '@nestjs/testing';
import { OrderReturnsController } from './order-returns.controller';
import { ReturnsWriteService } from './returns-write.service';

describe('OrderReturnsController', () => {
  let controller: OrderReturnsController;
  let returnsService: any;

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
    const mockReturnsService = {
      createReturn: jest.fn().mockResolvedValue(mockReturn),
      findByOrder: jest.fn().mockResolvedValue([mockReturn]),
      findOne: jest.fn().mockResolvedValue(mockReturn),
      updateReturn: jest.fn().mockResolvedValue(mockReturn),
      changeReturnState: jest
        .fn()
        .mockResolvedValue({ ...mockReturn, stateCode: 'confirmed' }),
      addReturnLine: jest.fn().mockResolvedValue(mockReturnLine),
      updateReturnLine: jest.fn().mockResolvedValue(mockReturnLine),
      removeReturnLine: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [OrderReturnsController],
      providers: [
        { provide: ReturnsWriteService, useValue: mockReturnsService },
      ],
    }).compile();

    controller = module.get<OrderReturnsController>(OrderReturnsController);
    returnsService = module.get(ReturnsWriteService);
  });

  describe('createReturn', () => {
    it('should call returnsService.createReturn with orderId, body, and actor', async () => {
      const body = {
        lines: [
          {
            salesOrderLineId: 'line-uuid-1',
            quantityReturned: '5',
            reason: 'Defective',
          },
        ],
      };
      const result = await controller.createReturn(
        'uuid-1',
        body as any,
        mockReq,
      );
      expect(result).toEqual(mockReturn);
      expect(returnsService.createReturn).toHaveBeenCalledWith(
        'uuid-1',
        body,
        'admin',
      );
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
      const result = await controller.updateReturn(
        'uuid-1',
        'ret-uuid-1',
        body,
        mockReq,
      );
      expect(result).toEqual(mockReturn);
      expect(returnsService.updateReturn).toHaveBeenCalledWith(
        'ret-uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('changeReturnState', () => {
    it('should call returnsService.changeReturnState with returnId, stateCode, and actor', async () => {
      const result = await controller.changeReturnState(
        'uuid-1',
        'ret-uuid-1',
        'confirmed',
        mockReq,
      );
      expect(result.stateCode).toBe('confirmed');
      expect(returnsService.changeReturnState).toHaveBeenCalledWith(
        'ret-uuid-1',
        'confirmed',
        'admin',
      );
    });
  });

  describe('addReturnLine', () => {
    it('should call returnsService.addReturnLine with returnId, body, and actor', async () => {
      const body = {
        salesOrderLineId: 'line-uuid-1',
        quantityReturned: '3',
        reason: 'Wrong item',
      };
      const result = await controller.addReturnLine(
        'uuid-1',
        'ret-uuid-1',
        body as any,
        mockReq,
      );
      expect(result).toEqual(mockReturnLine);
      expect(returnsService.addReturnLine).toHaveBeenCalledWith(
        'ret-uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('updateReturnLine', () => {
    it('should call returnsService.updateReturnLine', async () => {
      const body = { quantityReturned: '2' };
      const result = await controller.updateReturnLine(
        'uuid-1',
        'ret-uuid-1',
        'retline-uuid-1',
        body,
        mockReq,
      );
      expect(result).toEqual(mockReturnLine);
      expect(returnsService.updateReturnLine).toHaveBeenCalledWith(
        'ret-uuid-1',
        'retline-uuid-1',
        body,
        'admin',
      );
    });
  });

  describe('removeReturnLine', () => {
    it('should call returnsService.removeReturnLine', async () => {
      await controller.removeReturnLine(
        'uuid-1',
        'ret-uuid-1',
        'retline-uuid-1',
        mockReq,
      );
      expect(returnsService.removeReturnLine).toHaveBeenCalledWith(
        'ret-uuid-1',
        'retline-uuid-1',
        'admin',
      );
    });
  });
});
