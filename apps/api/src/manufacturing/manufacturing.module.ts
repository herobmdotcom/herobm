import { Module, forwardRef } from '@nestjs/common';
import { DrizzleModule } from '../drizzle/drizzle.module';
import { GlModule } from '../gl/gl.module';
import { InventoryModule } from '../inventory/inventory.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { WorkOrdersExecutionService } from './work-orders-execution.service';
import { WorkOrdersQueryService } from './work-orders-query.service';
import { WorkOrdersWriteService } from './work-orders-write.service';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';

@Module({
  imports: [
    DrizzleModule,
    forwardRef(() => InventoryModule),
    forwardRef(() => OrdersModule),
    GlModule,
    SettingsModule,
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
