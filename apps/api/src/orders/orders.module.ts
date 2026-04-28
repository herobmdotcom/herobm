import {
  Module,
  OnModuleInit,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { ReportsRegistry } from '../reports/reports.registry';
import { ReportsModule } from '../reports/reports.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { eq, sql } from 'drizzle-orm';
import {
  salesOrders,
  salesOrderLineItems,
  salesInvoices,
  accounts as coreAccounts,
} from '../drizzle/modbm-core-schema';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrderReturnsController } from './order-returns.controller';
import { OrderPickingController } from './order-picking.controller';
import { OrderShipmentsController } from './order-shipments.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { BackordersService } from './backorders.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { AllocationsController } from './allocations.controller';
import { TaxModule } from '../tax/tax.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ProductsModule } from '../products/products.module';
import { GlModule } from '../gl/gl.module';
import { PickingSlipService } from '../reports/picking-slip.service';
import { SalesInvoiceService as ReportSalesInvoiceService } from '../reports/sales-invoice.service';
import { SalesQuoteService } from '../reports/sales-quote.service';
import { SalesReturnCreditService } from '../reports/sales-return-credit.service';

@Module({
  imports: [
    ConfigModule,
    TaxModule,
    InventoryModule,
    AccountsModule,
    ProductsModule,
    GlModule,
    ReportsModule,
  ],
  controllers: [
    OrdersController,
    OrderReturnsController,
    OrderPickingController,
    OrderShipmentsController,
    AllocationsController,
  ],
  providers: [
    OrdersService,
    OrdersWriteService,
    BackordersService,
    ReturnsWriteService,
    PickingService,
    ShipmentService,
    PickingSlipService,
    ReportSalesInvoiceService,
    SalesQuoteService,
    SalesReturnCreditService,
  ],
  exports: [OrdersService, OrdersWriteService, BackordersService],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    private readonly reportsRegistry: ReportsRegistry,
    private readonly pickingSlipService: PickingSlipService,
    private readonly reportSalesInvoiceService: ReportSalesInvoiceService,
    private readonly salesQuoteService: SalesQuoteService,
    private readonly reportSalesReturnCreditService: SalesReturnCreditService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.reportsRegistry.register('sales-order', {
      resolveData: async (id: string, user: any) => {
        return (await this.salesQuoteService.assembleData(
          id,
          'app',
        )) as unknown as Record<string, any>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: salesOrders.salesOrderId })
          .from(salesOrders)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });

    this.reportsRegistry.register('picking-slip', {
      resolveData: async (id: string, user: any) => {
        return (await this.pickingSlipService.assembleData(
          id,
        )) as unknown as Record<string, any>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: salesOrders.salesOrderId })
          .from(salesOrders)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });

    this.reportsRegistry.register('sales-invoice', {
      resolveData: async (id: string, user: any) => {
        // Find corresponding orderId for the specified invoiceId
        const [inv] = await this.db
          .select({ orderId: salesInvoices.salesOrderId })
          .from(salesInvoices)
          .where(eq(salesInvoices.invoiceId, id));
        if (!inv || !inv.orderId)
          throw new NotFoundException(`Invoice ${id} not found`);
        return (await this.reportSalesInvoiceService.assembleData(
          inv.orderId,
          'app',
          id,
        )) as unknown as Record<string, any>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: salesInvoices.invoiceId })
          .from(salesInvoices)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });

    this.reportsRegistry.register('sales-return', {
      resolveData: async (id: string, user: any) => {
        return (await this.reportSalesReturnCreditService.assembleData(
          id,
          'app',
        )) as unknown as Record<string, any>;
      },
      getRandomId: async () => {
        return undefined; // Usually we don't need random resolving for returns
      },
    });
  }
}
