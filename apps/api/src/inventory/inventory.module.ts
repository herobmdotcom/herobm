import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { UomService } from './uom.service';
import { InventoryReportsService } from './inventory-reports.service';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GlModule, SettingsModule],
  controllers: [InventoryController],
  providers: [InventoryService, UomService, InventoryReportsService],
  exports: [InventoryService, UomService],
})
export class InventoryModule {}
