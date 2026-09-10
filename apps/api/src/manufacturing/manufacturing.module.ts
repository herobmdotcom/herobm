import { Module, forwardRef } from '@nestjs/common';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrdersQueryService } from './work-orders-query.service';
import { WorkOrdersWriteService } from './work-orders-write.service';
import { WorkOrdersExecutionService } from './work-orders-execution.service';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    DrizzleModule,
    forwardRef(() => InventoryModule),
    forwardRef(() => OrdersModule),
  ],
  controllers: [WorkOrdersController],
  providers: [
    WorkOrdersService,
    WorkOrdersQueryService,
    WorkOrdersWriteService,
    WorkOrdersExecutionService,
  ],
  exports: [
    WorkOrdersService,
    WorkOrdersQueryService,
    WorkOrdersWriteService,
    WorkOrdersExecutionService,
  ],
})
export class ManufacturingModule {}
