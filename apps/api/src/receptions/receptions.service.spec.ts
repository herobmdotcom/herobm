import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionsService } from './receptions.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('ReceptionsService', () => {
  let service: ReceptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        { provide: ConfigService, useValue: { get: jest.fn() } },
        ReceptionsService,
        { provide: DRIZZLE, useValue: {} },
        {
          provide: InventoryService,
          useValue: {
            recordInventoryMovement: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ReceptionsService>(ReceptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
