import { Module } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { InventoryModule } from '../inventory/inventory.module';

@Module({
  imports: [DrizzleModule, InventoryModule],
  controllers: [WorkOrdersController],
  providers: [WorkOrdersService],
  exports: [WorkOrdersService],
})
export class ManufacturingModule {}
