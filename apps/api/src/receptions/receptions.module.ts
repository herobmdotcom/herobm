import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';
import { InventoryModule } from '../inventory/inventory.module';

import { GlobalReceptionsController } from './global-receptions.controller';

@Module({
  imports: [ConfigModule, InventoryModule],
  controllers: [ReceptionsController, GlobalReceptionsController],
  providers: [ReceptionsService],
})
export class ReceptionsModule {}
