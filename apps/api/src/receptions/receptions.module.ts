import { Module } from '@nestjs/common';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';

@Module({
  controllers: [ReceptionsController],
  providers: [ReceptionsService]
})
export class ReceptionsModule {}
