import { Test, TestingModule } from '@nestjs/testing';
import { AccountsWriteService } from './accounts-write.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('AccountsWriteService', () => {
  let service: AccountsWriteService;

  const mockDb = {
    select: jest.fn(),
    transaction: jest.fn().mockImplementation((cb) => cb(mockDb)),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    values: jest.fn().mockReturnThis(),
    returning: jest.fn().mockResolvedValue([
      {
        accountId: '00000000-0000-0000-0000-000000000001',
        accountNumber: 'TEST001',
      },
    ]),
    limit: jest.fn().mockReturnThis(),
    from: jest.fn().mockReturnThis(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [AccountsWriteService, { provide: DRIZZLE, useValue: mockDb }],
    }).compile();

    service = module.get<AccountsWriteService>(AccountsWriteService);
  });

  describe('create', () => {
    it('should create a new account when it does not exist', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      const result = await service.create(
        { accountNumber: 'TEST001', name: 'Test' },
        'actor',
      );

      expect(result.accountNumber).toBe('TEST001');
      expect(mockDb.insert).toHaveBeenCalledTimes(2); // Account + Event
    });

    it('should throw BadRequestException if accountNumber exists in core', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ id: 'existing' }]),
      });

      await expect(
        service.create({ accountNumber: 'TEST001', name: 'Test' }, 'actor'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('should update an existing core account', async () => {
      const id = '00000000-0000-0000-0000-000000000001';
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([{ accountId: id }]),
      });

      await service.update(id, { name: 'Updated' }, 'actor');

      expect(mockDb.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if account does not exist anywhere', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([]),
      });

      await expect(
        service.update('invalid', { name: 'Updated' }, 'actor'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
