import { Module, forwardRef, Inject, OnModuleInit } from '@nestjs/common';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';
import { sql } from 'drizzle-orm';
import { purchaseOrders } from '@herobm/db-schema';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { DataSourcesRegistry } from '../data-sources/data-sources.registry';
import { AppConfigService } from '../settings/app-config.service';
import { assembleOrderData } from '../pdf-templates/report-data.helper';
import { PurchaseOrdersController } from './purchase-orders.controller';
import { PurchaseOrdersService } from './purchase-orders.service';
import { PurchaseOrdersQueryService } from './purchase-orders-query.service';
import { PurchaseOrdersStateService } from './purchase-orders-state.service';
import { PurchaseOrdersWriteService } from './purchase-orders-write.service';
import { PurchaseReturnsController } from './purchase-returns.controller';
import { PurchaseReturnsService } from './purchase-returns.service';
import { GlobalPurchaseReturnsController } from './global-purchase-returns.controller';
import { PurchasingReportsService } from './purchasing-reports.service';
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
  controllers: [
    PurchaseOrdersController,
    PurchaseReturnsController,
    GlobalPurchaseReturnsController,
  ],
  providers: [
    PurchaseOrdersService,
    PurchaseOrdersQueryService,
    PurchaseOrdersStateService,
    PurchaseOrdersWriteService,
    PurchaseReturnsService,
    PurchasingReportsService,
  ],
  exports: [
    PurchaseOrdersService,
    PurchaseOrdersQueryService,
    PurchaseOrdersStateService,
    PurchaseOrdersWriteService,
    PurchaseReturnsService,
  ],
})
export class PurchaseOrdersModule implements OnModuleInit {
  constructor(
    private readonly dataSourcesRegistry: DataSourcesRegistry,
    private readonly purchaseOrdersQueryService: PurchaseOrdersQueryService,
    private readonly appConfig: AppConfigService,
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
  ) {}

  onModuleInit() {
    this.dataSourcesRegistry.register(DATA_SOURCE_CONTEXT.PURCHASE_ORDER, {
      requiredPermissions: [{ resource: 'purchase-orders', action: 'read' }],
      resolveData: async (
        id: string,
        user: Record<string, unknown>,
        options?: Record<string, unknown>,
      ) => {
        const order = await this.purchaseOrdersQueryService.findOne(id);
        const homeCurrency = this.appConfig.homeCurrency();
        const data = assembleOrderData(
          {
            orderNumber: order.orderNumber,
            customerName: order.vendorName,
            customerOrderNumber: order.referenceNumber,
            createdOn: order.createdOn,
            currencyCode: order.currencyCode,
            name: order.name,
            lines: order.lines,
          },
          homeCurrency,
        );
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- dynamic report header extension
        const header = data.header as any;
        header.supplierName = order.vendorName || '';
        header.supplierReference = order.referenceNumber || '';
        header.referenceNumber = order.referenceNumber || '';
        if (order.expectedDate) {
          header.expectedDate = new Date(order.expectedDate).toLocaleDateString(
            'en-IE',
          );
        }
        const customText =
          (options?.customPdfText as string) ||
          (options?.quoteIntroText as string);
        if (customText) {
          data.customPdfText = customText;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- legacy report template compatibility
          (data as any).quoteIntroText = customText;
        }
        return data as unknown as Record<string, unknown>;
      },
      getRandomId: async () => {
        const rows = await this.db
          .select({ id: purchaseOrders.purchaseOrderId })
          .from(purchaseOrders)
          .orderBy(sql`RANDOM()`)
          .limit(1);
        return rows.length > 0 ? rows[0].id : undefined;
      },
    });
  }
}
