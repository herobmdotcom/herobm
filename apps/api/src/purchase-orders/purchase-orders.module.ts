import { Module } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { InventoryModule } from '../inventory/inventory.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { TaxModule } from '../tax/tax.module';
import { GlModule } from '../gl/gl.module';

@Module({
  imports: [InventoryModule, SuppliersModule, TaxModule, GlModule],
  controllers: [PurchaseOrdersController, PurchaseReturnsController],
  providers: [PurchaseOrdersService, PurchaseReturnsService],
})
export class PurchaseOrdersModule {}
