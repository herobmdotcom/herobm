import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoodsReceivedController } from './goods-received.controller';
import { GoodsReceivedService } from './goods-received.service';
import { InventoryModule } from '../inventory/inventory.module';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    ConfigModule,
    InventoryModule,
    GlModule,
    SettingsModule,
    PurchaseOrdersModule,
    OrdersModule,
  ],
  controllers: [GoodsReceivedController],
  providers: [GoodsReceivedService],
  exports: [GoodsReceivedService],
})
export class GoodsReceivedModule {}
