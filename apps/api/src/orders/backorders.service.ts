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
  taxCategories,
  locations,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { eq, inArray, and, sql } from 'drizzle-orm';
import { InventoryService } from '../inventory/inventory.service';
import { calculateInventoryGaps } from '@modbm/shared';
import { OPEN_PURCHASE_ORDER_STATES } from '@modbm/shared';
import type { InventoryGap, PurchaseOrderState } from '@modbm/shared';

import { AppConfigService } from '../settings/app-config.service';

@Injectable()
export class BackordersService {
  private readonly logger = new Logger(BackordersService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly appConfig: AppConfigService,
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
      // Fetch current state before unlinking to get the PO ID
      const [current] = await tx
        .select({ purchaseOrderId: backorders.purchaseOrderId })
        .from(backorders)
        .where(eq(backorders.backorderId, backorderId));

      await tx
        .update(backorders)
        .set({
          purchaseOrderId: null,
          purchaseOrderLineId: null,
          stateCode: 'pending_supply',
        })
        .where(eq(backorders.backorderId, backorderId));

      if (current && current.purchaseOrderId) {
        // Emit event on PO side using the old PO ID
        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: current.purchaseOrderId,
          eventType: EventType.DEMAND_UNALLOCATED,
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
    console.log('DEBUG: Starting MRP Allocation Engine run');
    await this.db.transaction(async (tx) => {
      // 1. Fetch all open demands
      const openDemands = await tx
        .select({
          backorderId: backorders.backorderId,
          productId: backorders.productId,
          quantity: backorders.quantity,
          salesOrderLineId: backorders.salesOrderLineId,
          salesOrderId: backorders.salesOrderId,
          stateCode: backorders.stateCode,
          orderNumber: salesOrders.orderNumber,
        })
        .from(backorders)
        .innerJoin(
          salesOrders,
          eq(backorders.salesOrderId, salesOrders.salesOrderId),
        )
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
        .where(inArray(purchaseOrders.stateCode, OPEN_PURCHASE_ORDER_STATES)); // Open POs

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
            demand = { ...newDemand, orderNumber: demand.orderNumber }; // For next iteration if there are more lines
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

      // [USER REQUEST]: Stop auto-creating draft POs. We will leave them as 'pending_supply'
      // in the backorders table, and they can be linked manually or via future consolidated workflows.
      this.logger.log(
        `Leaving ${unfulfilledDemands.length} demands as open Requisitions (no auto-PO creation).`,
      );
      return;

      /*
      // 4. Generate new POs for remaining demands
      const [defaultTaxCat] = await tx
        .select({ id: taxCategories.taxCategoryId })
        .from(taxCategories)
        .where(eq(taxCategories.isDefault, true))
        .limit(1);

      // If no default marked, just take the first one as an absolute safety fallback
      let fallbackTaxId = defaultTaxCat?.id;
      if (!fallbackTaxId) {
        const [firstCat] = await tx
          .select({ id: taxCategories.taxCategoryId })
          .from(taxCategories)
          .limit(1);
        fallbackTaxId = firstCat?.id;
      }

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
            currencyCode: sup.currencyCode || this.appConfig.homeCurrency(),
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
        const currencyCode =
          pref?.currencyCode || this.appConfig.homeCurrency();

        const orderNumber = await this.generatePurchaseOrderNumber(tx);
        const uniqueSoNumbers = [
          ...new Set(vendorGaps.map((g: any) => g.orderNumber)),
        ];

        const [po] = await tx
          .insert(purchaseOrders)
          .values({
            orderNumber,
            name: `Auto-Backorder PO ${orderNumber}`,
            vendorId,
            deliveryLocationId,
            stateCode: 'draft',
            currencyCode,
            notes: `Auto-generated to fulfill open demands: ${uniqueSoNumbers.join(', ')}`,
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
            purchaseTaxCategoryId?: string | null;
            quantity: number;
            price: string;
            gapRefs: typeof unfulfilledDemands;
          }
        >();
        for (const gap of vendorGaps) {
          const pref = preferredSupplierMap.get(gap.productId);
          if (!consolidatedLines.has(gap.productId)) {
            const [coreProd] = await tx
              .select({
                name: coreProducts.name,
                purchaseTaxCategoryId: coreProducts.purchaseTaxCategoryId,
              })
              .from(coreProducts)
              .where(eq(coreProducts.productId, gap.productId));
            consolidatedLines.set(gap.productId, {
              productDesc: coreProd?.name,
              purchaseTaxCategoryId: coreProd?.purchaseTaxCategoryId,
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
              taxCategoryId: lineInfo.purchaseTaxCategoryId || fallbackTaxId,
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
      */
    });
  }

  async generatePOsFromDemands(payload: any, actor: string) {
    this.logger.log(
      `Manual PO Generation triggered by ${actor} for ${payload.pos?.length || 0} POs`,
    );

    if (!payload || !payload.pos || !Array.isArray(payload.pos)) {
      throw new HttpException(
        'Invalid payload structure',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.db.transaction(async (tx) => {
      // 1. Get fallback tax category
      const [defaultTaxCat] = await tx
        .select({ id: taxCategories.taxCategoryId })
        .from(taxCategories)
        .where(eq(taxCategories.isDefault, true))
        .limit(1);

      let fallbackTaxId = defaultTaxCat?.id;
      if (!fallbackTaxId) {
        const [firstCat] = await tx
          .select({ id: taxCategories.taxCategoryId })
          .from(taxCategories)
          .limit(1);
        fallbackTaxId = firstCat?.id;
      }

      for (const poPayload of payload.pos) {
        if (!poPayload.vendorId) {
          throw new HttpException(
            'Cannot generate a PO without a vendorId',
            HttpStatus.BAD_REQUEST,
          );
        }

        const currencyCode =
          poPayload.currencyCode || this.appConfig.homeCurrency();
        const orderNumber = await this.generatePurchaseOrderNumber(tx);

        const soNotes =
          poPayload.soNumbers && poPayload.soNumbers.length > 0
            ? `to fulfill open demands from: ${poPayload.soNumbers.join(', ')}`
            : 'to fulfill open demands';

        let deliveryLocationId =
          poPayload.deliveryLocationId ||
          this.appConfig.defaultFulfillmentLocationId();
        if (!deliveryLocationId) {
          const locs = await tx.execute(
            sql`SELECT location_id FROM modbm_core.locations LIMIT 1`,
          );
          deliveryLocationId = (locs as any)[0]?.location_id;
        }
        if (!deliveryLocationId) {
          throw new HttpException(
            'No locations configured',
            HttpStatus.INTERNAL_SERVER_ERROR,
          );
        }

        const [po] = await tx
          .insert(purchaseOrders)
          .values({
            orderNumber,
            name: `Requisition PO ${orderNumber}`,
            vendorId: poPayload.vendorId,
            deliveryLocationId: deliveryLocationId,
            stateCode: 'draft',
            currencyCode,
            notes: `Generated ${soNotes}`,
            createdBy: actor,
          })
          .returning();

        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: po.purchaseOrderId,
          eventType: EventType.CREATED,
          actor,
          payload: { reason: 'manual_requisition' },
        });

        let openLineNumber = 1;
        for (const line of poPayload.lines) {
          const [coreProd] = await tx
            .select({
              name: coreProducts.name,
              purchaseTaxCategoryId: coreProducts.purchaseTaxCategoryId,
            })
            .from(coreProducts)
            .where(eq(coreProducts.productId, line.productId));

          const [poLine] = await tx
            .insert(purchaseOrderLineItems)
            .values({
              purchaseOrderId: po.purchaseOrderId,
              lineNumber: openLineNumber++,
              productId: line.productId,
              productDescription: coreProd?.name,
              quantity: line.quantity.toString(),
              pricePerUnit: line.pricePerUnit.toString(),
              taxCategoryId: coreProd?.purchaseTaxCategoryId || fallbackTaxId,
            })
            .returning();

          if (line.backorderIds && line.backorderIds.length > 0) {
            for (const backorderId of line.backorderIds) {
              await tx
                .update(backorders)
                .set({
                  purchaseOrderId: po.purchaseOrderId,
                  purchaseOrderLineId: poLine.purchaseOrderLineId,
                  stateCode: 'awaiting_receipt',
                })
                .where(eq(backorders.backorderId, backorderId));
            }
          }
        }
      }
    });
  }

  /**
   * Returns open PO lines for a given product, calculating their available unallocated capacity.
   */
  async getAvailablePoLines(productId: string) {
    if (!productId) return [];

    const openPoLines = await this.db
      .select({
        purchaseOrderId: purchaseOrders.purchaseOrderId,
        purchaseOrderLineId: purchaseOrderLineItems.purchaseOrderLineId,
        orderNumber: purchaseOrders.orderNumber,
        stateCode: purchaseOrders.stateCode,
        quantity: purchaseOrderLineItems.quantity,
        vendorId: purchaseOrders.vendorId,
        vendorName: coreSuppliers.name,
        deliveryLocationId: purchaseOrders.deliveryLocationId,
        locationName: locations.name,
      })
      .from(purchaseOrderLineItems)
      .innerJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(
        coreSuppliers,
        eq(purchaseOrders.vendorId, coreSuppliers.vendorId),
      )
      .leftJoin(
        locations,
        eq(purchaseOrders.deliveryLocationId, locations.locationId),
      )
      .where(
        and(
          eq(purchaseOrderLineItems.productId, productId),
          inArray(purchaseOrders.stateCode, OPEN_PURCHASE_ORDER_STATES),
        ),
      );

    if (openPoLines.length === 0) return [];

    const poLineIds = openPoLines.map((l) => l.purchaseOrderLineId);

    // Get existing allocations
    const existingAllocations = await this.db
      .select({
        purchaseOrderLineId: backorders.purchaseOrderLineId,
        allocatedQty: sql<number>`SUM(${backorders.quantity}::numeric)`,
      })
      .from(backorders)
      .where(inArray(backorders.purchaseOrderLineId, poLineIds))
      .groupBy(backorders.purchaseOrderLineId);

    const allocationMap = new Map<string, number>();
    for (const a of existingAllocations) {
      if (a.purchaseOrderLineId) {
        allocationMap.set(a.purchaseOrderLineId, Number(a.allocatedQty));
      }
    }

    const availableLines = openPoLines
      .map((line) => {
        const allocated = allocationMap.get(line.purchaseOrderLineId) || 0;
        return {
          ...line,
          availableQty: Number(line.quantity) - allocated,
        };
      })
      .filter((line) => line.availableQty > 0);

    return availableLines;
  }

  /**
   * Manually links an open demand to a specific PO line. Splits the demand if necessary.
   */
  async linkDemandToPo(
    demandId: string,
    purchaseOrderLineId: string,
    quantityToLink: number,
    actor: string,
  ) {
    await this.db.transaction(async (tx) => {
      // 1. Get the demand
      const [demand] = await tx
        .select()
        .from(backorders)
        .where(eq(backorders.backorderId, demandId));

      if (!demand)
        throw new HttpException('Demand not found', HttpStatus.NOT_FOUND);
      if (demand.purchaseOrderId)
        throw new HttpException(
          'Demand is already linked',
          HttpStatus.BAD_REQUEST,
        );

      const demandQty = Number(demand.quantity);
      if (quantityToLink <= 0 || quantityToLink > demandQty) {
        throw new HttpException('Invalid quantity', HttpStatus.BAD_REQUEST);
      }

      // 2. Get the target PO line
      const [poLine] = await tx
        .select({
          purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
          quantity: purchaseOrderLineItems.quantity,
          productId: purchaseOrderLineItems.productId,
        })
        .from(purchaseOrderLineItems)
        .where(
          eq(purchaseOrderLineItems.purchaseOrderLineId, purchaseOrderLineId),
        );

      if (!poLine)
        throw new HttpException('PO line not found', HttpStatus.NOT_FOUND);
      if (poLine.productId !== demand.productId)
        throw new HttpException('Product mismatch', HttpStatus.BAD_REQUEST);

      // Verify capacity
      const [existingAlloc] = await tx
        .select({
          allocated: sql<number>`SUM(${backorders.quantity}::numeric)`,
        })
        .from(backorders)
        .where(eq(backorders.purchaseOrderLineId, purchaseOrderLineId));

      const allocated = Number(existingAlloc?.allocated || 0);
      const available = Number(poLine.quantity) - allocated;

      if (quantityToLink > available) {
        throw new HttpException(
          `Insufficient capacity on PO line. Available: ${available}`,
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Link (and split if needed)
      if (quantityToLink < demandQty) {
        // Update current row to the allocated quantity
        await tx
          .update(backorders)
          .set({
            purchaseOrderId: poLine.purchaseOrderId,
            purchaseOrderLineId: purchaseOrderLineId,
            quantity: quantityToLink.toString(),
            stateCode: 'awaiting_receipt',
          })
          .where(eq(backorders.backorderId, demandId));

        // Create remaining demand
        const remainingQty = demandQty - quantityToLink;
        await tx.insert(backorders).values({
          salesOrderId: demand.salesOrderId,
          salesOrderLineId: demand.salesOrderLineId,
          productId: demand.productId,
          quantity: remainingQty.toString(),
          stateCode: 'pending_supply',
        });
      } else {
        // Fully allocate
        await tx
          .update(backorders)
          .set({
            purchaseOrderId: poLine.purchaseOrderId,
            purchaseOrderLineId: purchaseOrderLineId,
            stateCode: 'awaiting_receipt',
          })
          .where(eq(backorders.backorderId, demandId));
      }

      // Optional: Emit event
      await emitEvent(tx, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: poLine.purchaseOrderId,
        eventType: EventType.DEMAND_ALLOCATED,
        actor,
        payload: { backorderId: demandId, quantity: quantityToLink },
      });
    });
  }
}
