import { Test, TestingModule } from '@nestjs/testing';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';

describe('AccountsController', () => {
  let controller: AccountsController;
  let service: AccountsService;

  const mockResult = {
    data: [{ accountId: 'C001', name: 'Acme Corp' }],
    page: 1,
    limit: 50,
    total: 1,
  };

  const mockService = {
    findAll: jest.fn().mockResolvedValue(mockResult),
    findOne: jest.fn().mockResolvedValue({ accountId: 'C001', name: 'Acme Corp' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AccountsController],
      providers: [{ provide: AccountsService, useValue: mockService }],
    }).compile();

    controller = module.get<AccountsController>(AccountsController);
    service = module.get<AccountsService>(AccountsService);
  });

  describe('findAll', () => {
    it('should call service.findAll with no params', async () => {
      const result = await controller.findAll();
      expect(result).toEqual(mockResult);
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: undefined,
        page: undefined,
        limit: undefined,
      });
    });

    it('should parse page and limit from query strings', async () => {
      await controller.findAll('acme', '2', '25');
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: 'acme',
        page: 2,
        limit: 25,
      });
    });

    it('should pass undefined for unprovided pagination', async () => {
      await controller.findAll('test');
      expect(mockService.findAll).toHaveBeenCalledWith({
        search: 'test',
        page: undefined,
        limit: undefined,
      });
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
