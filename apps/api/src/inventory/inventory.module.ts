import { Module } from '@nestjs/common';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';
import { UomService } from './uom.service';

@Module({
  controllers: [InventoryController],
  providers: [InventoryService, UomService],
  exports: [InventoryService, UomService],
})
export class InventoryModule {}
