import { Module, forwardRef } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryQueryService } from './inventory-query.service';
import { InventoryMovementService } from './inventory-movement.service';
import { UomService } from './uom.service';
import { InventoryReportsService } from './inventory-reports.service';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';
import { OrdersModule } from '../orders/orders.module';
import { ManufacturingModule } from '../manufacturing/manufacturing.module';

@Module({
  imports: [
    GlModule,
    SettingsModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => ManufacturingModule),
  ],
  controllers: [InventoryController],
  providers: [
    InventoryQueryService,
    InventoryMovementService,
    UomService,
    InventoryReportsService,
  ],
  exports: [InventoryQueryService, InventoryMovementService, UomService],
})
export class InventoryModule {}
