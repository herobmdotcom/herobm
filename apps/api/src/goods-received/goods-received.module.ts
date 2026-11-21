import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GlModule } from '../gl/gl.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';
import { SettingsModule } from '../settings/settings.module';
import { GoodsReceivedCoreService } from './goods-received-core.service';
import { GoodsReceivedStateService } from './goods-received-state.service';
import { GoodsReceivedWriteService } from './goods-received-write.service';
import { GoodsReceivedController } from './goods-received.controller';

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
  providers: [
    GoodsReceivedCoreService,
    GoodsReceivedWriteService,
    GoodsReceivedStateService,
  ],
  exports: [
    GoodsReceivedCoreService,
    GoodsReceivedWriteService,
    GoodsReceivedStateService,
  ],
})
export class GoodsReceivedModule {}
