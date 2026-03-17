import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;

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

  // Chainable mock for Drizzle $dynamic() query builder
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    $dynamic: jest.fn(),
    then: jest.fn().mockImplementation((cb) => cb(mockAccounts)),
    [Symbol.asyncIterator]: jest.fn(),
  };

  const mockDb = {
    select: jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    // $dynamic() must return the same chainable object
    mockQueryBuilder.$dynamic.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.then = jest
      .fn()
      .mockImplementation((cb) => cb(mockAccounts));

    // Restore default mockDb.select implementation in case it was overwritten
    mockDb.select = jest.fn().mockReturnValue({
      from: jest.fn().mockReturnValue(mockQueryBuilder),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsService, { provide: DRIZZLE, useValue: mockDb }],
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
      const result = await service.findAll({ page: 2, limit: 10 });
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('should cap limit at 100000', async () => {
      const result = await service.findAll({ limit: 200_000 });
      expect(result.limit).toBe(100_000);
    });

    it('should apply search filter when q is provided', async () => {
      await service.findAll({ q: 'acme' });
      expect(mockQueryBuilder.where).toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('should return a single account', async () => {
      mockQueryBuilder.then = jest
        .fn()
        .mockImplementation((cb) => cb([mockAccounts[0]]));
      const result = await service.findOne('C001');
      expect(result).toEqual({
        ...mockAccounts[0],
        stateCode: 'active',
        source: 'abm',
        events: [],
      });
    });

    it('should return an app account with events if ID is UUID', async () => {
      const uuid = '12345678-1234-1234-1234-1234567890ab';
      const mockAppAccount = { ...mockAccounts[0], accountId: uuid };
      const mockEvent = {
        eventId: 'e1',
        eventType: 'created',
        createdOn: new Date(),
      };

      // Mock database calls for findOne with UUID
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation((limit) => ({
              then: jest.fn().mockImplementation((cb) => {
                // First call for account, second for events
                if (mockDb.select.mock.calls.length === 1) {
                  return cb([mockAppAccount]);
                }
                return cb([mockEvent]);
              }),
            })),
            orderBy: jest.fn().mockImplementation(() => ({
              then: jest.fn().mockImplementation((cb) => cb([mockEvent])),
            })),
          }),
        }),
      });

      const result = await service.findOne(uuid);
      expect(result).toHaveProperty('source', 'app');
      expect(result).toHaveProperty('events');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual(mockEvent);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockQueryBuilder.then = jest.fn().mockImplementation((cb) => cb([]));
      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
