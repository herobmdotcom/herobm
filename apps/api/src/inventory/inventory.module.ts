import { Module, forwardRef } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryQueryService } from './inventory-query.service';
import { DemandQueryService } from './demand-query.service';
import { InventoryMovementService } from './inventory-movement.service';
import { UomService } from './uom.service';
import { InventoryReportsService } from './inventory-reports.service';
import { StocktakesController } from './stocktakes/stocktakes.controller';
import { StocktakesQueryService } from './stocktakes/stocktakes-query.service';
import { StocktakesWriteService } from './stocktakes/stocktakes-write.service';
import { StocktakesCountsWriteService } from './stocktakes/stocktakes-counts-write.service';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';
import { OrdersModule } from '../orders/orders.module';
import { ManufacturingModule } from '../manufacturing/manufacturing.module';
import { ProjectsModule } from '../projects/projects.module';

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
