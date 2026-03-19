import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrderReturnsController } from './order-returns.controller';
import { OrderPickingController } from './order-picking.controller';
import { OrderShipmentsController } from './order-shipments.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { GstModule } from '../gst/gst.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ProductsModule } from '../products/products.module';

@Module({
  imports: [
    ConfigModule,
    GstModule,
    InventoryModule,
    AccountsModule,
    ProductsModule,
  ],
  controllers: [
    OrdersController,
    OrderReturnsController,
    OrderPickingController,
    OrderShipmentsController,
  ],
  providers: [
    OrdersService,
    OrdersWriteService,
    ReturnsWriteService,
    PickingService,
    ShipmentService,
  ],
  exports: [OrdersService, OrdersWriteService],
})
export class OrdersModule {}
