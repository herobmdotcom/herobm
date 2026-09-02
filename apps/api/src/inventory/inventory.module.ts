import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryQueryService } from './inventory-query.service';
import { InventoryMovementService } from './inventory-movement.service';
import { UomService } from './uom.service';
import { InventoryReportsService } from './inventory-reports.service';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GlModule, SettingsModule],
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
