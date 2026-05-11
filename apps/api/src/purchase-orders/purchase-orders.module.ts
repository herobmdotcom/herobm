import { Module, forwardRef } from '@nestjs/common';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { InventoryModule } from '../inventory/inventory.module';
import { SuppliersModule } from '../suppliers/suppliers.module';
import { TaxModule } from '../tax/tax.module';
import { GlModule } from '../gl/gl.module';
import { OrdersModule } from '../orders/orders.module';

@Module({
  imports: [
    InventoryModule,
    SuppliersModule,
    TaxModule,
    GlModule,
    forwardRef(() => OrdersModule),
  ],
  controllers: [PurchaseOrdersController, PurchaseReturnsController],
  providers: [PurchaseOrdersService, PurchaseReturnsService],
  exports: [PurchaseOrdersService, PurchaseReturnsService],
})
export class PurchaseOrdersModule {}
