import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoodsReceivedController } from './goods-received.controller';
import { GoodsReceivedService } from './goods-received.service';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [ConfigModule, InventoryModule],
  controllers: [GoodsReceivedController],
  providers: [GoodsReceivedService],
  exports: [GoodsReceivedService],
})
export class GoodsReceivedModule {}
