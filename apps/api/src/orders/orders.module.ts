import {
  Module,
  OnModuleInit,
  Inject,
  NotFoundException,
} from '@nestjs/common';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { PdfTemplatesModule } from '../pdf-templates/pdf-templates.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { eq, sql } from 'drizzle-orm';
import {
  salesOrders,
  salesOrderLineItems,
  salesInvoices,
  salesOrderShipments,
  customers as coreAccounts,
  transferOrders,
} from '@herobm/db-schema';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { ConfigModule } from '@nestjs/config';
import { OrdersController } from './orders.controller';
import { OrderReturnsController } from './order-returns.controller';
import { OrderPickingController } from './order-picking.controller';
import { OrderShipmentsController } from './order-shipments.controller';
import { GlobalShipmentsController } from './global-shipments.controller';
import { GlobalReturnsController } from './global-returns.controller';
import { OrdersService } from './orders.service';
import { OrdersCoreService } from './orders-core.service';
import { OrderCreationService } from './order-creation.service';
import { OrderLinesService } from './order-lines.service';
import { OrderStateService } from './order-state.service';
import { OrdersQueryService } from './orders-query.service';
import { BackordersService } from './backorders.service';
import { ReturnsWriteService } from './returns-write.service';
import { PickingService } from './picking.service';
import { ShipmentsCoreService } from './shipments/shipments-core.service';
import { ShipmentsWriteService } from './shipments/shipments-write.service';
import { ShipmentsStateService } from './shipments/shipments-state.service';
import { AllocationsController } from './allocations.controller';
import { TransfersController } from './transfers/transfers.controller';
import { TransfersCoreService } from './transfers/transfers-core.service';
import { TransfersWriteService } from './transfers/transfers-write.service';
import { TransfersStateService } from './transfers/transfers-state.service';
import { TaxModule } from '../tax/tax.module';
import { InventoryModule } from '../inventory/inventory.module';
import { CustomersModule } from '../customers/customers.module';
import { ProductsModule } from '../products/products.module';
import { GlModule } from '../gl/gl.module';
import { SettingsModule } from '../settings/settings.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { PickingSlipService } from '../pdf-templates/picking-slip.service';
import { SalesInvoiceService as ReportSalesInvoiceService } from '../pdf-templates/sales-invoice.service';
import { SalesQuoteService } from '../pdf-templates/sales-quote.service';
import { SalesReturnCreditService } from '../pdf-templates/sales-return-credit.service';

import { ShippingDocketService } from '../pdf-templates/shipping-docket.service';
import { BusinessReportsModule } from '../business-reports/business-reports.module';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [
    ConfigModule,
    TaxModule,
    InventoryModule,
    CustomersModule,
    ProductsModule,
    GlModule,
    SettingsModule,
    PdfTemplatesModule,
    InvoicesModule,
    EnrichmentModule,
    BusinessReportsModule,
    EmailModule,
  ],
  controllers: [
    OrderPickingController,
    OrdersController,
    OrderReturnsController,
    OrderShipmentsController,
    GlobalShipmentsController,
    GlobalReturnsController,
    AllocationsController,
    TransfersController,
  ],
  providers: [
    OrdersService,
    OrdersCoreService,
    OrderCreationService,
    OrderLinesService,
    OrderStateService,
    OrdersQueryService,
    BackordersService,
    ReturnsWriteService,
    PickingService,
    ShipmentsCoreService,
    ShipmentsWriteService,
    ShipmentsStateService,
    PickingSlipService,
    ReportSalesInvoiceService,
    SalesQuoteService,
    SalesReturnCreditService,
    ShippingDocketService,
    TransfersCoreService,
    TransfersWriteService,
    TransfersStateService,
  ],
  exports: [
    OrdersService,
    OrdersCoreService,
    OrderCreationService,
    OrderLinesService,
    OrderStateService,
    OrdersQueryService,
    BackordersService,
  ],
})
export class OrdersModule implements OnModuleInit {
  constructor(
    private readonly dataSourcesRegistry: DataSourcesRegistry,
    private readonly pickingSlipService: PickingSlipService,
    private readonly reportSalesInvoiceService: ReportSalesInvoiceService,
    private readonly salesQuoteService: SalesQuoteService,
    private readonly reportSalesReturnCreditService: SalesReturnCreditService,
    private readonly shippingDocketService: ShippingDocketService,
    @Inject(DRIZZLE) private db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.SALES_ORDER, {
      requiredPermissions: [{ resource: 'sales-orders', action: 'read' }],
      resolveData: async (
        id: string,
        user: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        return (await this.salesQuoteService.assembleData(id, 'app', {
          ...options,
          user,
        })) as unknown as Record<string, unknown>;
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

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.PICKING_SLIP, {
      requiredPermissions: [{ resource: 'sales-orders', action: 'read' }],
      resolveData: async (id: string, user: Record<string, unknown>) => {
        return (await this.pickingSlipService.assembleData(
          id,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        // Prefer sales orders, but fallback to transfer orders if none found
        const rows = await this.db
          .select({ id: salesOrders.salesOrderId })
          .from(salesOrders)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        if (rows.length > 0) return rows[0].id;

        const tRows = await this.db
          .select({ id: transferOrders.transferOrderId })
          .from(transferOrders)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return tRows.length > 0 ? tRows[0].id : undefined;
      },
    });

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.SALES_INVOICE, {
      requiredPermissions: [{ resource: 'sales-orders', action: 'read' }],
      resolveData: async (id: string, user: Record<string, unknown>) => {
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
        )) as unknown as Record<string, unknown>;
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

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.SALES_RETURN, {
      requiredPermissions: [{ resource: 'sales-returns', action: 'read' }],
      resolveData: async (id: string, user: Record<string, unknown>) => {
        return (await this.reportSalesReturnCreditService.assembleData(
          id,
          'app',
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        return undefined; // Usually we don't need random resolving for returns
      },
    });

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.SHIPMENT, {
      requiredPermissions: [{ resource: 'sales-orders', action: 'read' }],
      resolveData: async (id: string, user: Record<string, unknown>) => {
        return (await this.shippingDocketService.assembleData(
          id,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: salesOrderShipments.shipmentId })
          .from(salesOrderShipments)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });
  }
}
