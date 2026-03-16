import { Test, TestingModule } from '@nestjs/testing';
import { ReceptionsService } from './receptions.service';
import { DRIZZLE } from '../drizzle/drizzle.module';

describe('ReceptionsService', () => {
  let service: ReceptionsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReceptionsService,
        { provide: DRIZZLE, useValue: {} },
      ],
    }).compile();

    service = module.get<ReceptionsService>(ReceptionsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
