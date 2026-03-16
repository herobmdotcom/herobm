import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';

describe('ReceptionsController', () => {
  let controller: ReceptionsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReceptionsController],
      providers: [
        {
          provide: ReceptionsService,
          useValue: {
            findAll: jest.fn().mockResolvedValue({ data: [], total: 0 }),
            findOne: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    controller = module.get<ReceptionsController>(ReceptionsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
