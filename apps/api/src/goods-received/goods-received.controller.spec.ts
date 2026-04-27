import { Test, TestingModule } from '@nestjs/testing';
import { GoodsReceivedController } from './goods-received.controller';
import { GoodsReceivedService } from './goods-received.service';

describe('GoodsReceivedController', () => {
  let controller: GoodsReceivedController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GoodsReceivedController],
      providers: [
        {
          provide: GoodsReceivedService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            findOne: jest.fn().mockResolvedValue({}),
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
