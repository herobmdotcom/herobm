import { Test, TestingModule } from '@nestjs/testing';
import { AccountsService } from './accounts.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { NotFoundException } from '@nestjs/common';

describe('AccountsService', () => {
  let service: AccountsService;

  const mockAccounts = [
    {
      accountId: '12345678-1234-1234-1234-1234567890ab',
      accountNumber: 'ACME',
      name: 'Acme Corp',
      address1Line1: '123 Main St',
      stateCode: 'active',
      source: 'abm',
      sourceId: 'C001',
    },
    {
      accountId: '22345678-1234-1234-1234-1234567890ab',
      accountNumber: 'WIDGET',
      name: 'Widget Industries',
      address1Line1: '456 Oak Ave',
      stateCode: 'active',
      source: 'app',
      sourceId: null,
    },
  ];

  const mockEvent = {
    eventId: 'e1',
    eventType: 'imported',
    createdOn: new Date(),
  };

  // Chainable mock for Drizzle query builder
  const mockQueryBuilder = {
    where: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
    leftJoin: jest.fn().mockReturnThis(),
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
    mockQueryBuilder.$dynamic.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.where.mockReturnValue(mockQueryBuilder);
    mockQueryBuilder.then = jest
      .fn()
      .mockImplementation((cb) => cb(mockAccounts));

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
    it('should return an account by sourceId for non-UUID IDs', async () => {
      // Mock: first select().from().where().limit() returns the account,
      //       second select().from().where().orderBy() returns events
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => ({
              then: jest.fn().mockImplementation((cb) => {
                if (mockDb.select.mock.calls.length === 1) {
                  return cb([mockAccounts[0]]);
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

      const result = await service.findOne('C001');
      expect(result).toHaveProperty('source', 'abm');
      expect(result).toHaveProperty('events');
      expect(result.events).toHaveLength(1);
    });

    it('should return an account by UUID with events', async () => {
      const uuid = '12345678-1234-1234-1234-1234567890ab';

      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => ({
              then: jest.fn().mockImplementation((cb) => {
                if (mockDb.select.mock.calls.length === 1) {
                  return cb([mockAccounts[0]]);
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
      expect(result).toHaveProperty('source', 'abm');
      expect(result).toHaveProperty('events');
      expect(result.events).toHaveLength(1);
      expect(result.events[0]).toEqual(mockEvent);
    });

    it('should throw NotFoundException for unknown ID', async () => {
      mockDb.select = jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          leftJoin: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockImplementation(() => ({
              then: jest.fn().mockImplementation((cb) => cb([])),
            })),
          }),
        }),
      });

      await expect(service.findOne('NONEXISTENT')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
