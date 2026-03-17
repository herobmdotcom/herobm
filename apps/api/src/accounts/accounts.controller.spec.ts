import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AccountsWriteService } from './accounts-write.service';

describe('AccountsController', () => {
  let controller: AccountsController;

  const mockResult = {
    data: [{ accountId: 'C001', name: 'Acme Corp' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockResult),
    findOne: jest
      .fn()
      .mockResolvedValue({ accountId: 'C001', name: 'Acme Corp' }),
  };

  const mockWriteService = {
    create: jest.fn(),
    update: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [
        { provide: AccountsService, useValue: mockService },
        { provide: AccountsWriteService, useValue: mockWriteService },
      ],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
  });

  describe('findAll', () => {
    it('should call service.findAll with empty query', async () => {
      const result = await controller.findAll({});
      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith({});
    });

    it('should pass through PaginationQuery object', async () => {
      const query = { q: 'acme', page: 2, limit: 25 };
      await controller.findAll(query);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });

    it('should pass search without pagination', async () => {
      const query = { q: 'test' };
      await controller.findAll(query);
      expect(mockService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should call service.findOne with the ID', async () => {
      const result = await controller.findOne('C001');
      expect(result).toEqual({ accountId: 'C001', name: 'Acme Corp' });
      expect(mockService.findOne).toHaveBeenCalledWith('C001');
    });
  });
});
