import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;

  // Mock data matching mart_accounts CDM schema
  const mockAccounts = [
    {
      accountId: 'C001',
      accountNumber: 'ACME',
      name: 'Acme Corp',
      address1Line1: '123 Main St',
      stateCode: 'Active',
      deliveryAddressCount: 2,
    },
    {
      accountId: 'C002',
      accountNumber: 'WIDGET',
      name: 'Widget Industries',
      address1Line1: '456 Oak Ave',
      stateCode: 'Active',
      deliveryAddressCount: 1,
    },
  ];

  // Chainable mock for Drizzle query builder
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn().mockReturnThis(),
    then: jest.fn().mockImplementation((cb) => cb(mockAccounts)),
    [Symbol.asyncIterator]: jest.fn(),
  };

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    }),
  };

  beforeEach(async () => {
    // Reset mocks
    jest.clearAllMocks();
    mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb(mockAccounts));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountsService,
        { provide: DRIZZLE, useValue: mockDb },
      ],
    }).compile();

    service = module.get<AccountsService>(AccountsService);
  });

  describe('findAll', () => {
    it('should return paginated accounts', async () => {
      const result = await service.findAll();
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('page', 1);
      expect(result).toHaveProperty('limit', 50);
      expect(mockDb.select).toHaveBeenCalled();
    });

    it('should apply pagination parameters', async () => {
      await service.findAll({ page: 2, limit: 10 });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(10);
      expect(mockQueryBuilder.offset).toHaveBeenCalledWith(10);
    });

    it('should cap limit at 200', async () => {
      await service.findAll({ limit: 500 });
      expect(mockQueryBuilder.limit).toHaveBeenCalledWith(200);
    });

    it('should apply search filter when search is provided', async () => {
      await service.findAll({ search: 'acme' });
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single account', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb([mockAccounts[0]]));
      const result = await service.findOne('C001');
      expect(result).toEqual(mockAccounts[0]);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb([]));
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
