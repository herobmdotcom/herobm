import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedController } from './goods-received.controller';
import { GoodsReceivedCoreService } from './goods-received-core.service';
import { GoodsReceivedWriteService } from './goods-received-write.service';

describe('GoodsReceivedController', () => {
  let controller: GoodsReceivedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoodsReceivedController],
      providers: [
        {
          provide: GoodsReceivedCoreService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            findOne: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: GoodsReceivedWriteService,
          useValue: {
            create: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    controller = module.get<GoodsReceivedController>(GoodsReceivedController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
