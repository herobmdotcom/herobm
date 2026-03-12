import { Module } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { GstModule } from '../gst/gst.module';

@Module({
  imports: [GstModule],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersWriteService],
})
export class OrdersModule {}
