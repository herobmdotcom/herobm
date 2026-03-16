import { Test, TestingModule } from '@nestjs/testing';
import { PurchaseOrdersService } from './purchase-orders.service';
import { InventoryService } from '../inventory/inventory.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('PurchaseOrdersService', () => {
  let service: PurchaseOrdersService;

  const mockInventoryService = {
    commitStock: jest.fn().mockResolvedValue(undefined),
    releaseStock: jest.fn().mockResolvedValue(undefined),
    deductStock: jest.fn().mockResolvedValue(undefined),
    restoreStock: jest.fn().mockResolvedValue(undefined),
    returnStock: jest.fn().mockResolvedValue(undefined),
    placeOnOrder: jest.fn().mockResolvedValue(undefined),
    cancelOnOrder: jest.fn().mockResolvedValue(undefined),
    receiveStock: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseOrdersService,
        { provide: DRIZZLE, useValue: {} },
        { provide: InventoryService, useValue: mockInventoryService },
      ],
    }).compile();

    service = module.get<PurchaseOrdersService>(PurchaseOrdersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
