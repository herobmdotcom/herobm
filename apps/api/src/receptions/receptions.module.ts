import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ReceptionsController } from './receptions.controller';
import { ReceptionsService } from './receptions.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ConfigModule, InventoryModule],
  controllers: [ReceptionsController],
  providers: [ReceptionsService],
})
export class ReceptionsModule {}
