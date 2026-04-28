import { Test, TestingModule } from '@nestjs/testing';
import { SuppliersWriteService } from './suppliers-write.service';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SuppliersWriteService', () => {
  let service: SuppliersWriteService;
  let mockDb: any;

  beforeEach(async () => {
    mockDb = {
      select: jest.fn().mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
      transaction: jest.fn().mockImplementation(async (cb) => {
        const tx = {
          insert: jest.fn().mockReturnValue({
            values: jest.fn().mockReturnValue({
              returning: jest
                .fn()
                .mockResolvedValue([
                  { vendorId: 'new-uuid', vendorNumber: 'V-001' },
                ]),
            }),
          }),
          update: jest.fn().mockReturnValue({
            set: jest.fn().mockReturnValue({
              where: jest.fn().mockReturnValue({
                returning: jest
                  .fn()
                  .mockResolvedValue([{ vendorId: 'existing-uuid' }]),
              }),
            }),
          }),
        };
        return cb(tx);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SuppliersWriteService,
        { provide: DRIZZLE, useValue: mockDb },
        {
          provide: AppConfigService,
          useValue: { homeCurrency: jest.fn().mockReturnValue('EUR') },
        },
      ],
    }).compile();

    service = module.get<SuppliersWriteService>(SuppliersWriteService);
  });

  describe('create', () => {
    it('should create a supplier if vendor number is unique', async () => {
      const dto = { vendorNumber: 'V-001', name: 'Vendor 1' };
      const result = await service.create(dto, 'test-actor');
      expect(result.vendorNumber).toBe('V-001');
      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should throw if DB unique constraint is violated', async () => {
      // Vendor number uniqueness is enforced by DB UNIQUE constraint.
      // The transaction will throw when the insert fails.
      mockDb.transaction.mockRejectedValueOnce(
        new BadRequestException('Vendor number already exists'),
      );

      const dto = { vendorNumber: 'V-001', name: 'Vendor 1' };
      await expect(service.create(dto, 'test-actor')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('update', () => {
    const existingUuid = '88888888-4444-4444-4444-121212121212';

    it('should update an existing core supplier', async () => {
      mockDb.select.mockReturnValueOnce({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest
              .fn()
              .mockResolvedValue([{ vendorId: existingUuid, name: 'Old' }]),
          }),
        }),
      });

      const dto = { name: 'New' };
      const result = await service.update(existingUuid, dto, 'test-actor');
      expect(result.vendorId).toBe('existing-uuid');
    });

    it('should throw NotFoundException if supplier not found', async () => {
      mockDb.select.mockReturnValue({
        from: jest.fn().mockReturnValue({
          where: jest.fn().mockReturnValue({
            limit: jest.fn().mockResolvedValue([]),
          }),
        }),
      });

      await expect(
        service.update(existingUuid, {}, 'test-actor'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
