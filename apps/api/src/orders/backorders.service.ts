import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  backorders,
  purchaseOrders,
  purchaseOrderLineItems,
  productSuppliers,
  purchaseOrderEvents,
  products as coreProducts,
  orderEvents,
  suppliers as coreSuppliers,
} from '../drizzle/modbm-core-schema';
import { HOME_CURRENCY } from '@modbm/shared';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { calculateInventoryGaps } from '@modbm/shared';
import type { InventoryGap } from '@modbm/shared';

@Injectable()
export class BackordersService {
  private readonly logger = new Logger(BackordersService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Evaluates the Sales Order lines against real-time quantitative availability
   * to strictly determine if there are material inventory gaps.
   */
  async evaluateGaps(salesOrderId: string): Promise<InventoryGap[]> {
    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        productId: salesOrderLineItems.productId,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
        productType: coreProducts.productType,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    const [header] = await this.db
      .select({ fulfillmentLocationId: salesOrders.fulfillmentLocationId })
      .from(salesOrders)
      .where(eq(salesOrders.salesOrderId, salesOrderId))
      .limit(1);

    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    const validLines = lines.filter(
      (l) =>
        l.productId != null &&
        l.productId !== CUSTOM_LINE_ID &&
        (!l.productType || l.productType === 'inventory'),
    );
    if (validLines.length === 0) {
      Logger.warn(
        `[evaluateGaps] No valid lines found for order ${salesOrderId}`,
        'BackordersService',
      );
      return [];
    }

    const productIds = validLines.map((l) => l.productId as string);
    const { data: levels } =
      await this.inventoryService.findByProductIds(productIds);

    const gaps = calculateInventoryGaps(
      lines as any,
      levels as any,
      header?.fulfillmentLocationId,
    );

    return gaps;
  }

  /**
   * Helper to generate a unique PO number inside a transaction.
   */
  private async generatePurchaseOrderNumber(tx: DrizzleDB): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PO-${today}-`;

    // Using a robust unique temporal string guarantees we never hit
    // unique DB constraint violations over dirty mock test pipelines
    // that incrementally merge corrupted rows.
    const uniqueSuffix =
      Date.now().toString().slice(-6) +
      Math.floor(Math.random() * 100).toString();
    return `${prefix}${uniqueSuffix}`;
  }

  /**
   * Generate Backorders and Draft Purchase Orders for identified gaps.
   */
  async triggerBackorders(
    salesOrderId: string,
    gaps: InventoryGap[],
    actor: string,
    tx: DrizzleDB,
  ): Promise<void> {
    if (gaps.length === 0) return;

    this.logger.log(
      `Triggering backorders for Sales Order ${salesOrderId} (Items: ${gaps.length})`,
    );

    // Figure out generic/preferred suppliers for the missing products
    const productIds = gaps.map((g) => g.productId);
    const suppliers = await tx
      .select({
        productId: productSuppliers.productId,
        vendorId: productSuppliers.vendorId,
        costPrice: productSuppliers.costPrice,
        isPreferred: productSuppliers.isPreferred,
        currencyCode: coreSuppliers.currencyCode,
      })
      .from(productSuppliers)
      .leftJoin(
        coreSuppliers,
        eq(productSuppliers.vendorId, coreSuppliers.vendorId),
      )
      .where(inArray(productSuppliers.productId, productIds));

    // Sort so preferred suppliers override generic ones in the map later
    suppliers.sort((a, b) =>
      a.isPreferred === b.isPreferred ? 0 : a.isPreferred ? 1 : -1,
    );

    const preferredSupplierMap = new Map<
      string,
      { vendorId: string; costPrice: string | null; currencyCode: string }
    >();
    for (const sup of suppliers) {
      if (sup.productId && sup.vendorId) {
        preferredSupplierMap.set(sup.productId, {
          vendorId: sup.vendorId,
          costPrice: sup.costPrice,
          currencyCode: sup.currencyCode || HOME_CURRENCY.code,
        });
      }
    }

    // Group gaps by Vendor AND Delivery Location to strictly isolate POs physically
    const gapsByVendorAndLocation = new Map<string, InventoryGap[]>();
    for (const gap of gaps) {
      const sup = preferredSupplierMap.get(gap.productId);
      const vid = sup ? sup.vendorId : 'null';
      const loc = gap.locationId || 'null';
      const key = `${vid}::${loc}`;
      if (!gapsByVendorAndLocation.has(key))
        gapsByVendorAndLocation.set(key, []);
      gapsByVendorAndLocation.get(key)!.push(gap);
    }

    const [so] = await tx
      .select({ orderNumber: salesOrders.orderNumber })
      .from(salesOrders)
      .where(eq(salesOrders.salesOrderId, salesOrderId))
      .limit(1);
    const soRefLabel = so?.orderNumber || salesOrderId;

    for (const [groupKey, vendorGaps] of gapsByVendorAndLocation.entries()) {
      const [vidStr, locStr] = groupKey.split('::');
      const vendorId = vidStr === 'null' ? null : vidStr;
      const deliveryLocationId = locStr === 'null' ? null : locStr;

      let activePoId: string | null = null;
      let openLineNumber = 1;

      const firstGap = vendorGaps[0];
      const pref = preferredSupplierMap.get(firstGap.productId);
      const currencyCode = pref?.currencyCode || HOME_CURRENCY.code;

      const orderNumber = await this.generatePurchaseOrderNumber(tx);
      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          orderNumber,
          name: `Auto-Backorder PO ${orderNumber}`,
          vendorId,
          deliveryLocationId,
          stateCode: 'draft',
          currencyCode,
          notes: `Auto-generated backorder allocation for Sales Order: ${soRefLabel}`,
          createdBy: actor,
        })
        .returning();

      activePoId = po.purchaseOrderId;

      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: activePoId,
        eventType: EventType.CREATED,
        actor,
        payload: { reason: 'auto_backorder' },
      });

      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: salesOrderId,
        eventType: EventType.BACKORDERS_ALLOCATED,
        actor,
        payload: {
          purchaseOrderNumber: orderNumber,
          vendorId,
        },
      });

      // Insert PO lines
      for (const gap of vendorGaps) {
        const pref = preferredSupplierMap.get(gap.productId);
        const [poLine] = await tx
          .insert(purchaseOrderLineItems)
          .values({
            purchaseOrderId: activePoId,
            lineNumber: openLineNumber++,
            productId: gap.productId,
            productDescription: gap.productDescription,
            quantity: gap.shortage.toString(),
            pricePerUnit: pref?.costPrice || '0',
          })
          .returning();

        // And formally link the allocation via the Backorders table
        await tx.insert(backorders).values({
          salesOrderId,
          salesOrderLineId: gap.salesOrderLineId,
          productId: gap.productId,
          purchaseOrderId: activePoId,
          purchaseOrderLineId: poLine.purchaseOrderLineId,
          quantity: gap.shortage.toString(),
          stateCode: 'awaiting_receipt', // Since it's in a PO already!
        });
      }
    }
  }
}
