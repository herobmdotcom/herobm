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

    const uniqueSuffix =
      Date.now().toString().slice(-6) +
      Math.floor(Math.random() * 100).toString();
    return `${prefix}${uniqueSuffix}`;
  }

  /**
   * Generate Open Demand (Purchase Requisitions) for identified gaps.
   * This simply creates unlinked backorder rows.
   */
  async generateDemand(
    salesOrderId: string,
    gaps: InventoryGap[],
    actor: string,
    tx: DrizzleDB,
  ): Promise<void> {
    if (gaps.length === 0) return;

    this.logger.log(
      `Generating open demand for Sales Order ${salesOrderId} (Items: ${gaps.length})`,
    );

    for (const gap of gaps) {
      await tx.insert(backorders).values({
        salesOrderId,
        salesOrderLineId: gap.salesOrderLineId,
        productId: gap.productId,
        quantity: gap.shortage.toString(),
        stateCode: 'pending_supply',
      });
    }

    await emitEvent(tx, {
      aggregateType: AggregateType.SALES_ORDER,
      aggregateId: salesOrderId,
      eventType: EventType.BACKORDERS_ALLOCATED,
      actor,
      payload: { reason: 'demand_generated' },
    });
  }

  /**
   * Unlinks a specific demand record from a PO, returning it to open status.
   */
  async unlinkDemand(backorderId: string, actor: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx
        .update(backorders)
        .set({
          purchaseOrderId: null,
          purchaseOrderLineId: null,
          stateCode: 'pending_supply',
        })
        .where(eq(backorders.backorderId, backorderId))
        .returning();

      if (updated && updated.purchaseOrderId) {
        // Emit event on PO side
        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: updated.purchaseOrderId,
          eventType: 'demand_unlinked',
          actor,
          payload: { backorderId },
        });
      }
    });
  }

  /**
   * MRP Allocation Engine: Sweeps existing open POs to fulfill open demands,
   * then generates new consolidated draft POs for the remainder.
   */
  async resolveOpenDemands(actor: string): Promise<void> {
    this.logger.log('Starting MRP Allocation Engine run');
    await this.db.transaction(async (tx) => {
      // 1. Fetch all open demands
      const openDemands = await tx
        .select()
        .from(backorders)
        .where(
          and(
            sql`${backorders.purchaseOrderId} IS NULL`,
            eq(backorders.stateCode, 'pending_supply'),
          ),
        );

      if (openDemands.length === 0) {
        this.logger.log('No open demands to resolve.');
        return;
      }

      // 2. Fetch existing PO line capacity
      const draftPoLines = await tx
        .select({
          purchaseOrderId: purchaseOrders.purchaseOrderId,
          purchaseOrderLineId: purchaseOrderLineItems.purchaseOrderLineId,
          productId: purchaseOrderLineItems.productId,
          quantity: purchaseOrderLineItems.quantity,
          stateCode: purchaseOrders.stateCode,
          vendorId: purchaseOrders.vendorId,
          deliveryLocationId: purchaseOrders.deliveryLocationId,
          pricePerUnit: purchaseOrderLineItems.pricePerUnit,
        })
        .from(purchaseOrderLineItems)
        .innerJoin(
          purchaseOrders,
          eq(
            purchaseOrderLineItems.purchaseOrderId,
            purchaseOrders.purchaseOrderId,
          ),
        )
        .where(
          inArray(purchaseOrders.stateCode, ['draft', 'issued', 'confirmed']),
        ); // Open POs

      const existingAllocations = await tx
        .select({
          purchaseOrderLineId: backorders.purchaseOrderLineId,
          allocatedQty: sql<number>`SUM(${backorders.quantity}::numeric)`,
        })
        .from(backorders)
        .where(sql`${backorders.purchaseOrderLineId} IS NOT NULL`)
        .groupBy(backorders.purchaseOrderLineId);

      const allocationMap = new Map<string, number>();
      for (const a of existingAllocations) {
        allocationMap.set(
          a.purchaseOrderLineId as string,
          Number(a.allocatedQty),
        );
      }

      const availablePoLines = draftPoLines
        .map((line) => ({
          ...line,
          availableQty:
            Number(line.quantity) -
            (allocationMap.get(line.purchaseOrderLineId) || 0),
        }))
        .filter((line) => line.availableQty > 0);

      const unfulfilledDemands: (typeof openDemands)[0][] = [];

      // 3. Greedily map Demand to available PO capacity
      for (let demand of openDemands) {
        let remainingQty = Number(demand.quantity);
        let currentDemandId = demand.backorderId;

        // Find available lines for this product
        const matchingLines = availablePoLines.filter(
          (l) => l.productId === demand.productId && l.availableQty > 0,
        );

        for (const line of matchingLines) {
          if (remainingQty <= 0) break;

          const allocQty = Math.min(remainingQty, line.availableQty);
          line.availableQty -= allocQty;
          remainingQty -= allocQty;

          if (remainingQty > 0) {
            // Split demand: Update current row to allocQty, and insert new row for remainingQty
            await tx
              .update(backorders)
              .set({
                purchaseOrderId: line.purchaseOrderId,
                purchaseOrderLineId: line.purchaseOrderLineId,
                quantity: allocQty.toString(),
                stateCode: 'awaiting_receipt',
              })
              .where(eq(backorders.backorderId, currentDemandId));

            // Create remaining demand
            const [newDemand] = await tx
              .insert(backorders)
              .values({
                salesOrderId: demand.salesOrderId,
                salesOrderLineId: demand.salesOrderLineId,
                productId: demand.productId,
                quantity: remainingQty.toString(),
                stateCode: 'pending_supply',
              })
              .returning();

            currentDemandId = newDemand.backorderId;
            demand = newDemand; // For next iteration if there are more lines
          } else {
            // Fully allocated
            await tx
              .update(backorders)
              .set({
                purchaseOrderId: line.purchaseOrderId,
                purchaseOrderLineId: line.purchaseOrderLineId,
                quantity: allocQty.toString(),
                stateCode: 'awaiting_receipt',
              })
              .where(eq(backorders.backorderId, currentDemandId));
          }
        }

        if (remainingQty > 0) {
          // Update demand object with remaining quantity for new PO generation
          demand.quantity = remainingQty.toString();
          unfulfilledDemands.push(demand);
        }
      }

      if (unfulfilledDemands.length === 0) {
        this.logger.log('All demands resolved by existing POs.');
        return;
      }

      // 4. Generate new POs for remaining demands
      const productIds = unfulfilledDemands.map((g) => g.productId);
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

      const gapsByVendorAndLocation = new Map<
        string,
        typeof unfulfilledDemands
      >();
      for (const gap of unfulfilledDemands) {
        const sup = preferredSupplierMap.get(gap.productId);
        const vid = sup ? sup.vendorId : 'null';
        // Assume location from the Sales Order line... wait, we don't have location on backorder.
        // Let's lookup location from SO header for grouping.
        const [soLine] = await tx
          .select({
            fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
          })
          .from(salesOrderLineItems)
          .where(
            eq(salesOrderLineItems.salesOrderLineId, gap.salesOrderLineId),
          );
        const loc = soLine?.fulfillmentLocationId || 'null';
        const key = `${vid}::${loc}`;
        if (!gapsByVendorAndLocation.has(key))
          gapsByVendorAndLocation.set(key, []);
        gapsByVendorAndLocation.get(key)!.push(gap);
      }

      for (const [groupKey, vendorGaps] of gapsByVendorAndLocation.entries()) {
        const [vidStr, locStr] = groupKey.split('::');
        const vendorId = vidStr === 'null' ? null : vidStr;
        const deliveryLocationId = locStr === 'null' ? null : locStr;

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
            notes: `Auto-generated to fulfill open demands`,
            createdBy: actor,
          })
          .returning();

        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: po.purchaseOrderId,
          eventType: EventType.CREATED,
          actor,
          payload: { reason: 'auto_backorder' },
        });

        // Consolidate lines for the same product to avoid many 1-qty lines
        const consolidatedLines = new Map<
          string,
          {
            productDesc?: string;
            quantity: number;
            price: string;
            gapRefs: typeof unfulfilledDemands;
          }
        >();
        for (const gap of vendorGaps) {
          const pref = preferredSupplierMap.get(gap.productId);
          if (!consolidatedLines.has(gap.productId)) {
            const [coreProd] = await tx
              .select({ name: coreProducts.name })
              .from(coreProducts)
              .where(eq(coreProducts.productId, gap.productId));
            consolidatedLines.set(gap.productId, {
              productDesc: coreProd?.name,
              quantity: 0,
              price: pref?.costPrice || '0',
              gapRefs: [],
            });
          }
          const item = consolidatedLines.get(gap.productId)!;
          item.quantity += Number(gap.quantity);
          item.gapRefs.push(gap);
        }

        let openLineNumber = 1;
        for (const [productId, lineInfo] of consolidatedLines.entries()) {
          const [poLine] = await tx
            .insert(purchaseOrderLineItems)
            .values({
              purchaseOrderId: po.purchaseOrderId,
              lineNumber: openLineNumber++,
              productId: productId,
              productDescription: lineInfo.productDesc,
              quantity: lineInfo.quantity.toString(),
              pricePerUnit: lineInfo.price,
            })
            .returning();

          for (const gap of lineInfo.gapRefs) {
            await tx
              .update(backorders)
              .set({
                purchaseOrderId: po.purchaseOrderId,
                purchaseOrderLineId: poLine.purchaseOrderLineId,
                stateCode: 'awaiting_receipt',
              })
              .where(eq(backorders.backorderId, gap.backorderId));
          }
        }
      }
    });
  }
}
