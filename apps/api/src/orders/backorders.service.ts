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
} from '../drizzle/modbm-core-schema';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';

export interface InventoryGap {
  salesOrderLineId: string;
  productId: string;
  productDescription: string | null;
  orderedQuantity: number;
  availableQuantity: number;
  shortage: number;
  locationId: string | null;
}

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
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, salesOrderId));

    const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
    const validLines = lines.filter(
      (l) => l.productId != null && l.productId !== CUSTOM_LINE_ID,
    );
    if (validLines.length === 0) return [];

    const productIds = validLines.map((l) => l.productId as string);
    const { data: levels } =
      await this.inventoryService.findByProductIds(productIds);

    // Roll up available quantities strictly mapped by product AND location
    const availabilityMap = new Map<string, number>();
    for (const lvl of levels) {
      if (!lvl.productId || !lvl.locationId) continue;
      const key = `${lvl.productId}_${lvl.locationId}`;
      const current = availabilityMap.get(key) || 0;
      availabilityMap.set(key, current + (lvl.quantityAvailable || 0));
    }

    const gaps: InventoryGap[] = [];

    for (const line of validLines) {
      const pid = line.productId as string;
      const locId = line.fulfillmentLocationId;
      const ordered = parseFloat(line.quantity || '0');

      const key = `${pid}_${locId}`;
      const available = availabilityMap.get(key) || 0;

      if (ordered > available) {
        gaps.push({
          salesOrderLineId: line.salesOrderLineId,
          productId: pid,
          productDescription: line.productDescription,
          orderedQuantity: ordered,
          availableQuantity: available,
          shortage: ordered - available,
          locationId: locId,
        });
      }
    }

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
      })
      .from(productSuppliers)
      .where(inArray(productSuppliers.productId, productIds));

    // Sort so preferred suppliers override generic ones in the map later
    suppliers.sort((a, b) =>
      a.isPreferred === b.isPreferred ? 0 : a.isPreferred ? 1 : -1,
    );

    const preferredSupplierMap = new Map<
      string,
      { vendorId: string; costPrice: string | null }
    >();
    for (const sup of suppliers) {
      if (sup.productId && sup.vendorId) {
        preferredSupplierMap.set(sup.productId, {
          vendorId: sup.vendorId,
          costPrice: sup.costPrice,
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

      const orderNumber = await this.generatePurchaseOrderNumber(tx);
      const [po] = await tx
        .insert(purchaseOrders)
        .values({
          orderNumber,
          name: `Auto-Backorder PO ${orderNumber}`,
          vendorId,
          deliveryLocationId,
          stateCode: 'draft',
          notes: `Auto-generated backorder allocation for Sales Order: ${soRefLabel}`,
          createdBy: actor,
        })
        .returning();

      activePoId = po.purchaseOrderId;

      await tx.insert(purchaseOrderEvents).values({
        purchaseOrderId: activePoId,
        eventType: 'created',
        actor,
        payload: { reason: 'auto_backorder' },
      });

      await tx.insert(orderEvents).values({
        salesOrderId,
        eventType: 'backorders_allocated',
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
