import { Module, forwardRef } from '@nestjs/common';
import { GlModule } from '../gl/gl.module';
import { ManufacturingModule } from '../manufacturing/manufacturing.module';
import { OrdersModule } from '../orders/orders.module';
import { ProjectsModule } from '../projects/projects.module';
import { SettingsModule } from '../settings/settings.module';
import { DemandQueryService } from './demand-query.service';
import { InventoryMovementService } from './inventory-movement.service';
import { InventoryQueryService } from './inventory-query.service';
import { InventoryReportsService } from './inventory-reports.service';
import { InventoryController } from './inventory.controller';
import { StocktakesCountsWriteService } from './stocktakes/stocktakes-counts-write.service';
import { StocktakesQueryService } from './stocktakes/stocktakes-query.service';
import { StocktakesWriteService } from './stocktakes/stocktakes-write.service';
import { StocktakesController } from './stocktakes/stocktakes.controller';
import { UomService } from './uom.service';

@Module({
  imports: [
    GlModule,
    SettingsModule,
    forwardRef(() => OrdersModule),
    forwardRef(() => ManufacturingModule),
    forwardRef(() => ProjectsModule),
  ],
  controllers: [InventoryController, StocktakesController],
  providers: [
    InventoryQueryService,
    DemandQueryService,
    InventoryMovementService,
    UomService,
    InventoryReportsService,
    StocktakesQueryService,
    StocktakesWriteService,
    StocktakesCountsWriteService,
  ],
  exports: [
    InventoryQueryService,
    DemandQueryService,
    InventoryMovementService,
    UomService,
    StocktakesQueryService,
    StocktakesWriteService,
    StocktakesCountsWriteService,
  ],
})
export class InventoryModule {}
