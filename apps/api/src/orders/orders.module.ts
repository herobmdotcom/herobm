import {
  salesInvoices,
  salesOrderShipments,
  salesOrders,
  transferOrders,
} from '@herobm/db-schema';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { Inject, Module, OnModuleInit, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { sql } from 'drizzle-orm';
import { CustomersModule } from '../customers/customers.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DRIZZLE } from '../drizzle/drizzle.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { GlModule } from '../gl/gl.module';
import { InventoryModule } from '../inventory/inventory.module';
import { InvoicesModule } from '../invoices/invoices.module';
import { PdfTemplatesModule } from '../pdf-templates/pdf-templates.module';
import { PickingSlipService } from '../pdf-templates/picking-slip.service';
import { SalesInvoiceService as ReportSalesInvoiceService } from '../pdf-templates/sales-invoice.service';
import { SalesQuoteService } from '../pdf-templates/sales-quote.service';
import { SalesReturnCreditService } from '../pdf-templates/sales-return-credit.service';
import { ProductsModule } from '../products/products.module';
import { SettingsModule } from '../settings/settings.module';
import { TaxModule } from '../tax/tax.module';
import { AllocationsController } from './allocations.controller';
import { BackordersService } from './backorders.service';
import { DirectFulfillmentService } from './direct-fulfillment.service';
import { GlobalReturnsController } from './global-returns.controller';
import { GlobalReturnsService } from './global-returns.service';
import { GlobalShipmentsController } from './global-shipments.controller';
import { OrderCreationService } from './order-creation.service';
import { OrderLinesService } from './order-lines.service';
import { OrderPickingController } from './order-picking.controller';
import { OrderReturnsController } from './order-returns.controller';
import { OrderShipmentsController } from './order-shipments.controller';
import { OrderStateService } from './order-state.service';
import { OrdersCoreService } from './orders-core.service';
import { OrdersQueryService } from './orders-query.service';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PickingActionService } from './picking-action.service';
import { PickingQueryService } from './picking-query.service';
import { PickingShippingQueryService } from './picking-shipping-query.service';
import { PickingService } from './picking.service';
import { ReturnsWriteService } from './returns-write.service';
import { ShipmentsCoreService } from './shipments/shipments-core.service';
import { ShipmentsStateService } from './shipments/shipments-state.service';
import { ShipmentsWriteService } from './shipments/shipments-write.service';
import { TransfersCoreService } from './transfers/transfers-core.service';
import { TransfersPickingService } from './transfers/transfers-picking.service';
import { TransfersShipmentService } from './transfers/transfers-shipment.service';
import { TransfersStateService } from './transfers/transfers-state.service';
import { TransfersWriteService } from './transfers/transfers-write.service';
import { TransfersController } from './transfers/transfers.controller';
import { UnifiedReturnsController } from './unified-returns.controller';

import { BusinessReportsModule } from '../business-reports/business-reports.module';
import { EmailModule } from '../email/email.module';
import { ManufacturingModule } from '../manufacturing/manufacturing.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ShippingDocketService } from '../pdf-templates/shipping-docket.service';
import { PurchaseOrdersModule } from '../purchase-orders/purchase-orders.module';

@Module({
  imports: [
    ConfigModule,
    TaxModule,
    forwardRef(() => InventoryModule),
    CustomersModule,
    ProductsModule,
    GlModule,
    SettingsModule,
    PdfTemplatesModule,
    forwardRef(() => InvoicesModule),
    EnrichmentModule,
    BusinessReportsModule,
    EmailModule,
    NotificationsModule,
    forwardRef(() => ManufacturingModule),
    forwardRef(() => PurchaseOrdersModule),
  ],
  controllers: [
    OrderPickingController,
    OrdersController,
    OrderReturnsController,
    OrderShipmentsController,
    GlobalShipmentsController,
    GlobalReturnsController,
    UnifiedReturnsController,
    AllocationsController,
    TransfersController,
  ],
  providers: [
    GlobalReturnsService,
    OrdersService,
    OrdersCoreService,
    OrderCreationService,
    OrderLinesService,
    OrderStateService,
    OrdersQueryService,
    BackordersService,
    ReturnsWriteService,
    DirectFulfillmentService,
    PickingService,
    PickingQueryService,
    PickingShippingQueryService,
    PickingActionService,
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
    TransfersPickingService,
    TransfersShipmentService,
  ],
  exports: [
    OrdersService,
    OrdersCoreService,
    OrderCreationService,
    OrderLinesService,
    OrderStateService,
    OrdersQueryService,
    DirectFulfillmentService,
    BackordersService,
    ReturnsWriteService,
    PickingService,
    PickingQueryService,
    PickingShippingQueryService,
    PickingActionService,
    TransfersPickingService,
    TransfersShipmentService,
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
      resolveData: async (id: string, _user: Record<string, unknown>) => {
        return (await this.pickingSlipService.assembleData(
          id,
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
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
      resolveData: async (
        id: string,
        _user: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        return (await this.reportSalesInvoiceService.assembleInvoiceData(
          id,
          options,
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
      resolveData: async (id: string, _user: Record<string, unknown>) => {
        return (await this.reportSalesReturnCreditService.assembleData(
          id,
          'app',
        )) as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        return undefined;
      },
    });

    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.SHIPMENT, {
      requiredPermissions: [{ resource: 'sales-orders', action: 'read' }],
      resolveData: async (
        id: string,
        user: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        return (await this.shippingDocketService.assembleData(
          id,
          options,
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
