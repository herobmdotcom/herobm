import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GoodsReceivedController } from './goods-received.controller';
import { GoodsReceivedCoreService } from './goods-received-core.service';
import { GoodsReceivedWriteService } from './goods-received-write.service';
import { GoodsReceivedStateService } from './goods-received-state.service';
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
