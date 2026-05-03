import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { UomService } from './uom.service';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [GlModule, SettingsModule],
  controllers: [InventoryController],
  providers: [InventoryService, UomService],
  exports: [InventoryService, UomService],
})
export class InventoryModule {}
