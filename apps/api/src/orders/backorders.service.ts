import {
  Injectable,
  Logger,
  HttpException,
  HttpStatus,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
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
import { eq, sql, and, inArray } from 'drizzle-orm';
import {
  BACKORDER_STATE,
  PURCHASE_ORDER_STATE,
  TRANSFER_ORDER_STATE,
  OPEN_PURCHASE_ORDER_STATES,
  BACKORDER_TRANSITIONS,
} from '@modbm/shared';
import { InventoryService } from '../inventory/inventory.service';
import { calculateInventoryGaps } from '@modbm/shared';
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
        structureType: coreProducts.structureType,
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
        stateCode: BACKORDER_STATE.PENDING_SUPPLY,
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

      await this.changeBackorderState(
        backorderId,
        BACKORDER_STATE.PENDING_SUPPLY,
        actor,
        tx,
        {
          purchaseOrderId: null,
          purchaseOrderLineId: null,
        },
      );

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
            eq(backorders.stateCode, BACKORDER_STATE.PENDING_SUPPLY),
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
            await this.changeBackorderState(
              currentDemandId,
              BACKORDER_STATE.AWAITING_RECEIPT,
              actor,
              tx,
              {
                purchaseOrderId: line.purchaseOrderId,
                purchaseOrderLineId: line.purchaseOrderLineId,
                quantity: allocQty.toString(),
              },
            );

            // Create remaining demand
            const [newDemand] = await tx
              .insert(backorders)
              .values({
                salesOrderId: demand.salesOrderId,
                salesOrderLineId: demand.salesOrderLineId,
                productId: demand.productId,
                quantity: remainingQty.toString(),
                stateCode: BACKORDER_STATE.PENDING_SUPPLY,
              })
              .returning();

            currentDemandId = newDemand.backorderId;
            demand = { ...newDemand, orderNumber: demand.orderNumber }; // For next iteration if there are more lines
          } else {
            // Fully allocated
            await this.changeBackorderState(
              currentDemandId,
              BACKORDER_STATE.AWAITING_RECEIPT,
              actor,
              tx,
              {
                purchaseOrderId: line.purchaseOrderId,
                purchaseOrderLineId: line.purchaseOrderLineId,
                quantity: allocQty.toString(),
              },
            );
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
            stateCode: PURCHASE_ORDER_STATE.DRAFT,
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
              await this.changeBackorderState(
                backorderId,
                BACKORDER_STATE.AWAITING_RECEIPT,
                actor,
                tx,
                {
                  purchaseOrderId: po.purchaseOrderId,
                  purchaseOrderLineId: poLine.purchaseOrderLineId,
                },
              );
            }
          }
        }
      }
    });
  }

  async generateTransfersFromDemands(payload: any, actor: string) {
    this.logger.warn(
      `generateTransfersFromDemands called by ${actor} but not fully implemented yet`,
    );
    // Stub to fix build
    return { success: false, message: 'Not implemented' };
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
        await this.changeBackorderState(
          demandId,
          BACKORDER_STATE.AWAITING_RECEIPT,
          actor,
          tx,
          {
            purchaseOrderId: poLine.purchaseOrderId,
            purchaseOrderLineId: purchaseOrderLineId,
            quantity: quantityToLink.toString(),
          },
        );

        // Create remaining demand
        const remainingQty = demandQty - quantityToLink;
        await tx.insert(backorders).values({
          salesOrderId: demand.salesOrderId,
          salesOrderLineId: demand.salesOrderLineId,
          productId: demand.productId,
          quantity: remainingQty.toString(),
          stateCode: BACKORDER_STATE.PENDING_SUPPLY,
        });
      } else {
        // Fully allocate
        await this.changeBackorderState(
          demandId,
          BACKORDER_STATE.AWAITING_RECEIPT,
          actor,
          tx,
          {
            purchaseOrderId: poLine.purchaseOrderId,
            purchaseOrderLineId: purchaseOrderLineId,
          },
        );
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

  /**
   * Reallocates a demand (backorder) to a new fulfillment location.
   * This unlinks any existing PO allocations for the entire sales order line,
   * updates the line's fulfillment location, and re-evaluates the gap.
   */
  async reallocateDemand(
    backorderId: string,
    newLocationId: string,
    actor: string,
  ) {
    await this.db.transaction(async (tx) => {
      // 1. Get the current demand to find the salesOrderLineId
      const [demand] = await tx
        .select({
          salesOrderId: backorders.salesOrderId,
          salesOrderLineId: backorders.salesOrderLineId,
        })
        .from(backorders)
        .where(eq(backorders.backorderId, backorderId));

      if (!demand) {
        throw new HttpException('Demand not found', HttpStatus.NOT_FOUND);
      }

      // 2. Find ALL demands for this line
      const lineDemands = await tx
        .select({
          backorderId: backorders.backorderId,
          purchaseOrderId: backorders.purchaseOrderId,
        })
        .from(backorders)
        .where(eq(backorders.salesOrderLineId, demand.salesOrderLineId));

      // 3. Unlink any linked demands
      for (const ld of lineDemands) {
        if (ld.purchaseOrderId) {
          // Inline the unlink logic so we can pass 'tx' (since unlinkDemand uses its own transaction internally if not passed)
          // Actually, unlinkDemand uses this.db.transaction. If we call it inside tx, it's fine (Drizzle supports nested but it's better to just inline the update)
          await this.changeBackorderState(
            ld.backorderId,
            BACKORDER_STATE.PENDING_SUPPLY,
            actor,
            tx,
            {
              purchaseOrderId: null,
              purchaseOrderLineId: null,
            },
          );

          await emitEvent(tx, {
            aggregateType: AggregateType.PURCHASE_ORDER,
            aggregateId: ld.purchaseOrderId,
            eventType: EventType.DEMAND_UNALLOCATED,
            actor,
            payload: { backorderId: ld.backorderId },
          });
        }
      }

      // 4. Update the Sales Order Line's fulfillmentLocationId
      await tx
        .update(salesOrderLineItems)
        .set({ fulfillmentLocationId: newLocationId })
        .where(
          eq(salesOrderLineItems.salesOrderLineId, demand.salesOrderLineId),
        );

      // 5. Delete all backorders for this line to recalculate cleanly
      await tx
        .delete(backorders)
        .where(eq(backorders.salesOrderLineId, demand.salesOrderLineId));

      // 6. Run gap evaluation for the order
      const gaps = await this.evaluateGaps(demand.salesOrderId);

      // Filter the gaps to only the line we just touched
      const lineGaps = gaps.filter(
        (g) => g.salesOrderLineId === demand.salesOrderLineId,
      );

      // 7. Regenerate demand for this line if there is still a shortage
      if (lineGaps.length > 0) {
        // We need to implement generateDemand logic inline or pass tx
        // generateDemand accepts tx as a parameter
        await this.generateDemand(demand.salesOrderId, lineGaps, actor, tx);
      }

      // 8. Emit an event indicating reallocation
      await emitEvent(tx, {
        aggregateType: AggregateType.SALES_ORDER,
        aggregateId: demand.salesOrderId,
        eventType: EventType.DEMAND_REALLOCATED,
        actor,
        payload: {
          lineId: demand.salesOrderLineId,
          newLocationId,
          stillHasShortage: lineGaps.length > 0,
        },
      });
    });
  }
  /**
   * Formal state transition helper for Backorders.
   * Ensures transitions follow the state machine and emits events.
   */
  async changeBackorderState(
    backorderId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
    additionalFields: Record<string, unknown> = {},
  ) {
    const db = tx || this.db;

    const [existing] = await db
      .select()
      .from(backorders)
      .where(eq(backorders.backorderId, backorderId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(`Backorder ${backorderId} not found`);
    }

    const allowed = BACKORDER_TRANSITIONS[existing.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition backorder from ${existing.stateCode} to ${newState}`,
      );
    }

    const [updated] = await db
      .update(backorders)
      .set({
        stateCode: newState as any,
        modifiedOn: new Date(),
        ...additionalFields,
      })
      .where(eq(backorders.backorderId, backorderId))
      .returning();

    await emitEvent(db, {
      aggregateType: AggregateType.SALES_ORDER,
      aggregateId: existing.salesOrderId,
      eventType: EventType.STATUS_CHANGED,
      actor,
      payload: {
        entity: 'backorder',
        entityId: backorderId,
        from: existing.stateCode,
        to: newState,
      },
    });

    return updated;
  }
}
