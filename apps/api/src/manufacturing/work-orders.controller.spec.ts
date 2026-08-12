/* eslint-disable @typescript-eslint/unbound-method -- Jest mock functions are referenced in assertions without calling them */
import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto';

describe('WorkOrdersController', () => {
  let controller: WorkOrdersController;
  let service: WorkOrdersService;

  const mockWorkOrdersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    release: jest.fn(),
    completeBuild: jest.fn(),
    cancel: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrdersController],
      providers: [
        {
          provide: WorkOrdersService,
          useValue: mockWorkOrdersService,
        },
      ],
    }).compile();

    controller = module.get<WorkOrdersController>(WorkOrdersController);
    service = module.get<WorkOrdersService>(WorkOrdersService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('findAll', () => {
    it('should call service.findAll with parsed days', async () => {
      const mockResult = [{ workOrderId: '1', orderNumber: 'WO-001' }];
      mockWorkOrdersService.findAll.mockResolvedValue(mockResult);

      const result = await controller.findAll('30');

      expect(service.findAll).toHaveBeenCalledWith(30);
      expect(result).toBe(mockResult);
    });

    it('should call service.findAll with undefined when days is omitted', async () => {
      mockWorkOrdersService.findAll.mockResolvedValue([]);

      await controller.findAll(undefined);

      expect(service.findAll).toHaveBeenCalledWith(undefined);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with id', async () => {
      const mockResult = { workOrderId: 'wo-100', orderNumber: 'WO-100' };
      mockWorkOrdersService.findOne.mockResolvedValue(mockResult);

      const result = await controller.findOne('wo-100');

      expect(service.findOne).toHaveBeenCalledWith('wo-100');
      expect(result).toBe(mockResult);
    });
  });

  describe('create', () => {
    it('should call service.create with dto and username from user context', async () => {
      const dto: CreateWorkOrderDto = {
        productId: 'prod-uuid',
        targetQuantity: '10',
        locationId: 'loc-uuid',
      };
      const mockUser = { username: 'testuser', sub: 'user-sub', role: 'admin' };
      const mockResult = {
        workOrderId: 'wo-new',
        orderNumber: 'WO-20260811-001',
      };

      mockWorkOrdersService.create.mockResolvedValue(mockResult);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing controller decorator parameter passing
      const result = await controller.create(dto, mockUser as any);

      expect(service.create).toHaveBeenCalledWith(dto, 'testuser');
      expect(result).toBe(mockResult);
    });
  });

  describe('release', () => {
    it('should call service.release with id and username', async () => {
      const mockUser = { username: 'testuser' };
      const mockResult = { workOrderId: 'wo-1', stateCode: 'in_progress' };
      mockWorkOrdersService.release.mockResolvedValue(mockResult);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing decorator parameter passing
      const result = await controller.release('wo-1', mockUser as any);

      expect(service.release).toHaveBeenCalledWith('wo-1', 'testuser');
      expect(result).toBe(mockResult);
    });
  });

  describe('completeBuild', () => {
    it('should call service.completeBuild with id and username', async () => {
      const mockUser = { username: 'testuser' };
      const mockResult = { workOrderId: 'wo-1', stateCode: 'completed' };
      mockWorkOrdersService.completeBuild.mockResolvedValue(mockResult);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing decorator parameter passing
      const result = await controller.completeBuild('wo-1', mockUser as any);

      expect(service.completeBuild).toHaveBeenCalledWith(
        'wo-1',
        undefined,
        'testuser',
      );
      expect(result).toBe(mockResult);
    });
  });

  describe('cancel', () => {
    it('should call service.cancel with id and username', async () => {
      const mockUser = { username: 'testuser' };
      const mockResult = { workOrderId: 'wo-1', stateCode: 'cancelled' };
      mockWorkOrdersService.cancel.mockResolvedValue(mockResult);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Testing decorator parameter passing
      const result = await controller.cancel('wo-1', mockUser as any);

      expect(service.cancel).toHaveBeenCalledWith('wo-1', 'testuser');
      expect(result).toBe(mockResult);
    });
  });
});
