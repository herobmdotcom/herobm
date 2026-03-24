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
  accounts as coreAccounts,
} from '../drizzle/modbm-core-schema';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrderReturnsController } from './order-returns.controller';
import { OrderPickingController } from './order-picking.controller';
import { OrderShipmentsController } from './order-shipments.controller';
import { OrdersService } from './orders.service';
import { OrdersWriteService } from './orders-write.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentService } from './shipment.service';
import { GstModule } from '../gst/gst.module';
import { InventoryModule } from '../inventory/inventory.module';
import { AccountsModule } from '../accounts/accounts.module';
import { ProductsModule } from '../products/products.module';
import { GlModule } from '../gl/gl.module';
import { PickingSlipService } from '../reports/picking-slip.service';
import { SalesInvoiceService as ReportSalesInvoiceService } from '../reports/sales-invoice.service';

@Module({
  imports: [
    ConfigModule,
    GstModule,
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
  ],
  providers: [
    OrdersService,
    OrdersWriteService,
    ReturnsWriteService,
    PickingService,
    ShipmentService,
    PickingSlipService,
    ReportSalesInvoiceService,
  ],
  exports: [OrdersService, OrdersWriteService],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    private readonly reportsRegistry: ReportsRegistry,
    private readonly pickingSlipService: PickingSlipService,
    private readonly reportSalesInvoiceService: ReportSalesInvoiceService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.reportsRegistry.register('sales-order', {
      resolveData: async (id: string, user: any) => {
        const orderRows = await this.db
          .select()
          .from(salesOrders)
          .where(eq(salesOrders.salesOrderId, id))
          .limit(1);
        if (orderRows.length === 0) {
          throw new NotFoundException(
            `Order ${id} not found for report generation`,
          );
        }
        const order = orderRows[0];

        const lines = await this.db
          .select()
          .from(salesOrderLineItems)
          .where(eq(salesOrderLineItems.salesOrderId, id));

        // Attempt to fetch customer. Not all orders have a customerId mapped to core accounts.
        let customer = null;
        if (order.customerId) {
          const custRows = await this.db
            .select()
            .from(coreAccounts)
            .where(eq(coreAccounts.accountId, order.customerId))
            .limit(1);
          if (custRows.length > 0) customer = custRows[0];
        }

        return { order, lines, customer, generatedBy: user.username };
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
          .select({ orderId: sql<string>`sales_order_id` })
          .from(sql`sales_invoices`)
          .where(sql`invoice_id = ${id}`);
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
          .select({ id: sql<string>`invoice_id` })
          .from(sql`sales_invoices`)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });
  }
}
