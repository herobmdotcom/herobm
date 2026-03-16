import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { GstModule } from '../gst/gst.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [GstModule, InventoryModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersWriteService, ReturnsWriteService, PickingService, ShipmentService],
})
export class OrdersModule {}
