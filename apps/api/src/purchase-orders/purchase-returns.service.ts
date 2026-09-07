import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and, desc, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderReturnShipments,
  purchaseOrderReturnShipmentLines,
  procurementEvents,
  bins,
  binContents,
  zones,
  products as coreProducts,
  suppliers,
  supplierGroups,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { CreatePurchaseReturnDto, ShipPurchaseReturnDto } from './dto';
import {
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_TRANSITIONS,
  PURCHASE_RETURN_SHIPMENT_STATE,
  PURCHASE_ORDER_STATE,
  getValidStates,
  PurchaseReturnState,
  PurchaseReturnShipmentState,
} from '@herobm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { evaluatePOLifecycleRules } from './purchase-order-lifecycle-rules';
import { InventoryMovementService } from '../inventory/inventory-movement.service';

const VALID_RETURN_STATES = getValidStates(PURCHASE_RETURN_TRANSITIONS);

@Injectable()
export class PurchaseReturnsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  private readonly logger = new Logger(PurchaseReturnsService.name);

  private async generateReturnNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PRT-${today}-`;

    const result = await db
      .select({ returnNumber: purchaseOrderReturns.returnNumber })
      .from(purchaseOrderReturns)
      .where(sql`${purchaseOrderReturns.returnNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${purchaseOrderReturns.returnNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].returnNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  private async generateShipmentNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `RSH-${today}-`;

    const result = await db
      .select({ shipmentNumber: purchaseOrderReturnShipments.shipmentNumber })
      .from(purchaseOrderReturnShipments)
      .where(
        sql`${purchaseOrderReturnShipments.shipmentNumber} LIKE ${prefix + '%'}`,
      )
      .orderBy(sql`${purchaseOrderReturnShipments.shipmentNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].shipmentNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  async createReturn(
    purchaseOrderId: string,
    dto: CreatePurchaseReturnDto,
    actor: string,
  ) {
    const [order] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .limit(1);

    if (!order) throw new NotFoundException('Purchase order not found');

    if (
      order.stateCode !== PURCHASE_ORDER_STATE.RECEIVED &&
      order.stateCode !== PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED &&
      order.stateCode !== PURCHASE_ORDER_STATE.INVOICED
    ) {
      throw new BadRequestException(
        'Cannot return against a PO that has no receptions.',
      );
    }

    const returnNumber = await this.generateReturnNumber();

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [ret] = await tx
        .insert(purchaseOrderReturns)
        .values({
          returnNumber,
          purchaseOrderId,
          stateCode: PURCHASE_RETURN_STATE.DRAFT,
          notes: dto.notes,
          createdBy: actor,
        })
        .returning();

      const lineValues = dto.lines.map((line) => ({
        returnId: ret.returnId,
        purchaseOrderLineId: line.purchaseOrderLineId,
        quantityReturned: line.quantityReturned,
        reason: line.reason,
        returnFee: line.returnFee ?? '0',
        sourceBinId: line.sourceBinId || null,
      }));

      if (lineValues.length > 0) {
        await tx.insert(purchaseOrderReturnLines).values(lineValues);
      }

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.RETURN_CREATED,
        entityDisplayName: order.orderNumber,
        payload: { returnId: ret.returnId, returnNumber },
        actor,
      });

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_RETURN,
        entityId: ret.returnId,
        eventType: EventType.CREATED,
        entityDisplayName: returnNumber,
        payload: {
          purchaseOrderId,
          lineCount: lineValues.length,
        },
        actor,
      });

      return ret;
    });

    return result;
  }

  async findByOrder(purchaseOrderId: string) {
    const returns = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.purchaseOrderId, purchaseOrderId))
      .orderBy(desc(purchaseOrderReturns.createdOn));

    const returnIds = returns.map((r) => r.returnId);
    const allLines =
      returnIds.length > 0
        ? await this.db
            .select()
            .from(purchaseOrderReturnLines)
            .where(inArray(purchaseOrderReturnLines.returnId, returnIds))
        : [];

    const linesByReturnId = new Map<string, typeof allLines>();
    for (const l of allLines) {
      const list = linesByReturnId.get(l.returnId) || [];
      list.push(l);
      linesByReturnId.set(l.returnId, list);
    }

    return returns.map((ret) => ({
      ...ret,
      lines: linesByReturnId.get(ret.returnId) || [],
    }));
  }

  async findOne(returnId: string) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');

    const lines = await this.db
      .select()
      .from(purchaseOrderReturnLines)
      .where(eq(purchaseOrderReturnLines.returnId, returnId));

    return { ...ret, lines };
  }

  async stageReturn(returnId: string, actor: string) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (ret.stateCode !== PURCHASE_RETURN_STATE.DRAFT) {
      throw new BadRequestException(
        'Return must be in DRAFT state to be staged',
      );
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    const returnLines = await this.db
      .select()
      .from(purchaseOrderReturnLines)
      .where(eq(purchaseOrderReturnLines.returnId, returnId));

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // Move inventory from warehouse storage bins INTO SUPPLIER_RETURNS bin
      if (po.deliveryLocationId && returnLines.length > 0) {
        const [supplierReturnsBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(bins.binNumber, 'SUPPLIER_RETURNS'),
              eq(zones.locationId, po.deliveryLocationId),
            ),
          )
          .limit(1);

        if (!supplierReturnsBin) {
          throw new BadRequestException(
            'SUPPLIER_RETURNS bin not found for location',
          );
        }

        const poLineIds = returnLines.map((rl) => rl.purchaseOrderLineId);
        const orderLineRows =
          poLineIds.length > 0
            ? await tx
                .select()
                .from(purchaseOrderLineItems)
                .where(
                  inArray(
                    purchaseOrderLineItems.purchaseOrderLineId,
                    poLineIds,
                  ),
                )
            : [];

        const orderLinesMap = new Map(
          orderLineRows.map((ol) => [ol.purchaseOrderLineId, ol]),
        );

        for (const rl of returnLines) {
          if (!rl.sourceBinId) {
            throw new BadRequestException(
              `Source bin (sourceBinId) is required for return line '${rl.returnLineId}' before it can be staged.`,
            );
          }

          const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

          if (!orderLine || !orderLine.productId) {
            throw new BadRequestException(
              `Purchase order line not found for return line ${rl.returnLineId}`,
            );
          }

          const qty = parseFloat(rl.quantityReturned || '0');
          if (qty <= 0) {
            throw new BadRequestException(
              `Invalid quantity returned for return line ${rl.returnLineId}`,
            );
          }

          const movementNumber = `MOV-${Date.now()}`;
          await this.inventoryMovementService.recordInventoryMovement(tx, {
            entryNumber: movementNumber,
            sourceType: 'PURCHASE_RETURN_STAGE',
            sourceId: returnId,
            userId: actor,
            lines: [
              {
                productId: orderLine.productId,
                binId: rl.sourceBinId,
                quantity: -qty,
                uomCode: orderLine.unitOfMeasure || 'EA',
              },
              {
                productId: orderLine.productId,
                binId: supplierReturnsBin.binId,
                quantity: qty,
                uomCode: orderLine.unitOfMeasure || 'EA',
              },
            ],
          });
        }
      }

      const updated = await this.changePurchaseReturnState(
        returnId,
        PURCHASE_RETURN_STATE.STAGED,
        actor,
        tx,
      );

      // @herobm-skip-audit
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: po.orderNumber,
        payload: {
          entity: 'return',
          entityId: returnId,
          returnNumber: ret.returnNumber,
          from: ret.stateCode,
          to: PURCHASE_RETURN_STATE.STAGED,
        },
        actor,
      });

      return updated;
    });

    return result;
  }

  async unstageReturn(returnId: string, actor: string) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (ret.stateCode !== PURCHASE_RETURN_STATE.STAGED) {
      throw new BadRequestException(
        'Return must be in STAGED state to be unstaged',
      );
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    const returnLines = await this.db
      .select()
      .from(purchaseOrderReturnLines)
      .where(eq(purchaseOrderReturnLines.returnId, returnId));

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      if (po.deliveryLocationId && returnLines.length > 0) {
        const [supplierReturnsBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(bins.binNumber, 'SUPPLIER_RETURNS'),
              eq(zones.locationId, po.deliveryLocationId),
            ),
          )
          .limit(1);

        if (!supplierReturnsBin) {
          throw new BadRequestException(
            'SUPPLIER_RETURNS bin not found for location',
          );
        }

        const poLineIds = returnLines.map((rl) => rl.purchaseOrderLineId);
        const orderLineRows =
          poLineIds.length > 0
            ? await tx
                .select()
                .from(purchaseOrderLineItems)
                .where(
                  inArray(
                    purchaseOrderLineItems.purchaseOrderLineId,
                    poLineIds,
                  ),
                )
            : [];

        const orderLinesMap = new Map(
          orderLineRows.map((ol) => [ol.purchaseOrderLineId, ol]),
        );

        for (const rl of returnLines) {
          const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

          if (!orderLine || !orderLine.productId) {
            throw new BadRequestException(
              `Purchase order line not found for return line ${rl.returnLineId}`,
            );
          }

          if (!rl.sourceBinId) {
            throw new BadRequestException(
              `Source bin not found for return line ${rl.returnLineId}`,
            );
          }

          const qty = parseFloat(rl.quantityReturned || '0');
          if (qty <= 0) {
            throw new BadRequestException(
              `Invalid quantity returned for return line ${rl.returnLineId}`,
            );
          }

          const movementNumber = `MOV-${Date.now()}`;
          await this.inventoryMovementService.recordInventoryMovement(tx, {
            entryNumber: movementNumber,
            sourceType: 'PURCHASE_RETURN_UNSTAGE',
            sourceId: returnId,
            userId: actor,
            lines: [
              {
                productId: orderLine.productId,
                binId: supplierReturnsBin.binId,
                quantity: -qty,
                uomCode: orderLine.unitOfMeasure || 'EA',
              },
              {
                productId: orderLine.productId,
                binId: rl.sourceBinId,
                quantity: qty,
                uomCode: orderLine.unitOfMeasure || 'EA',
              },
            ],
          });
        }
      }

      const updated = await this.changePurchaseReturnState(
        returnId,
        PURCHASE_RETURN_STATE.DRAFT,
        actor,
        tx,
      );

      // @herobm-skip-audit
      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: po.orderNumber,
        payload: {
          entity: 'return',
          entityId: returnId,
          returnNumber: ret.returnNumber,
          from: ret.stateCode,
          to: PURCHASE_RETURN_STATE.DRAFT,
        },
        actor,
      });

      return updated;
    });

    return result;
  }

  async cancelReturn(returnId: string, actor: string) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (
      ret.stateCode !== PURCHASE_RETURN_STATE.DRAFT &&
      ret.stateCode !== PURCHASE_RETURN_STATE.STAGED
    ) {
      throw new BadRequestException(
        'Only DRAFT or STAGED returns can be cancelled',
      );
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const updated = await this.changePurchaseReturnState(
        returnId,
        PURCHASE_RETURN_STATE.CANCELLED,
        actor,
        tx,
      );

      // @herobm-skip-audit - DB write is performed by changePurchaseReturnState, emitting cross-entity event here

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: po.orderNumber,
        payload: {
          entity: 'return',
          entityId: returnId,
          returnNumber: ret.returnNumber,
          from: ret.stateCode,
          to: PURCHASE_RETURN_STATE.CANCELLED,
        },
        actor,
      });

      return updated;
    });

    return result;
  }

  async shipReturn(
    returnId: string,
    actor: string,
    dto?: ShipPurchaseReturnDto,
  ) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (ret.stateCode !== PURCHASE_RETURN_STATE.STAGED) {
      throw new BadRequestException(
        'Return must be STAGED before it can be shipped',
      );
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // 1. Mark Return as SHIPPED
      const updated = await this.changePurchaseReturnState(
        returnId,
        PURCHASE_RETURN_STATE.SHIPPED,
        actor,
        tx,
      );

      // 2. Create the shipment record
      const shipmentNumber = await this.generateShipmentNumber(tx);
      const [shipment] = await tx
        .insert(purchaseOrderReturnShipments)
        .values({
          shipmentNumber,
          returnId,
          stateCode: PURCHASE_RETURN_SHIPMENT_STATE.DISPATCHED,
          fulfillmentLocationId: po.deliveryLocationId,
          trackingNumber: dto?.trackingNumber || null,
          notes: dto?.notes || null,
          createdBy: actor,
        })
        .returning();

      const returnLines = await tx
        .select()
        .from(purchaseOrderReturnLines)
        .where(eq(purchaseOrderReturnLines.returnId, returnId));

      const shipmentLineValues = returnLines.map((rl) => ({
        shipmentId: shipment.shipmentId,
        returnLineId: rl.returnLineId,
        quantityShipped: rl.quantityReturned,
      }));

      if (shipmentLineValues.length > 0) {
        await tx
          .insert(purchaseOrderReturnShipmentLines)
          .values(shipmentLineValues);
      }

      // 3. Deduct inventory from SUPPLIER_RETURNS bin
      const poLineIds = returnLines.map((rl) => rl.purchaseOrderLineId);
      const orderLineRows =
        poLineIds.length > 0
          ? await tx
              .select()
              .from(purchaseOrderLineItems)
              .where(
                inArray(purchaseOrderLineItems.purchaseOrderLineId, poLineIds),
              )
          : [];

      const orderLinesMap = new Map(
        orderLineRows.map((ol) => [ol.purchaseOrderLineId, ol]),
      );

      const stockLines = [];
      for (const rl of returnLines) {
        const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

        if (orderLine) {
          stockLines.push({
            productId: orderLine.productId,
            quantity: rl.quantityReturned,
            uomCode: orderLine.unitOfMeasure,
          });
        }
      }

      if (po.deliveryLocationId) {
        const [supplierReturnsBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(bins.binNumber, 'SUPPLIER_RETURNS'),
              eq(zones.locationId, po.deliveryLocationId),
            ),
          )
          .limit(1);

        if (!supplierReturnsBin) {
          throw new BadRequestException(
            `SUPPLIER_RETURNS bin not found for location '${po.deliveryLocationId}'`,
          );
        }

        const validStockLines = stockLines.filter(
          (l) => l.productId != null,
        ) as { productId: string; quantity: string; uomCode: string }[];

        const moveLines = validStockLines.map((line) => ({
          productId: line.productId,
          binId: supplierReturnsBin.binId,
          quantity: -parseFloat(line.quantity), // negative quantity for removing from inventory
          uomCode: line.uomCode,
        }));

        if (moveLines.length > 0) {
          await this.inventoryMovementService.recordInventoryMovement(tx, {
            entryNumber:
              'RSH-' +
              shipment.shipmentNumber +
              '-' +
              Date.now().toString().slice(-4),
            sourceType: 'PO_RETURN',
            sourceId: returnId,
            memo: 'Return shipped to Supplier',
            userId: actor,
            lines: moveLines,
          });
        }
      }

      // Decrement PO quantity Received
      let totalValueReturned = 0;
      for (const rl of returnLines) {
        // Calculate financial value of return
        const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

        if (orderLine && orderLine.pricePerUnit) {
          totalValueReturned +=
            parseFloat(orderLine.pricePerUnit) *
            parseFloat(rl.quantityReturned);
        }

        await tx.execute(
          sql`UPDATE herobm_core.purchase_order_lines SET quantity_received = (quantity_received::numeric - ${rl.quantityReturned}::numeric) WHERE purchase_order_line_id = ${rl.purchaseOrderLineId}`,
        );
      }

      // 4. Financial Integration (GL)
      if (totalValueReturned > 0) {
        const accountingStrategy = getAccountingStrategy(
          this.appConfig.inventoryAccountingMode(),
          {
            inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
            grniAccountId: this.appConfig.defaultGrniAccountId(),
            cogsAccountId: this.appConfig.defaultCogsAccountId(),
            shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
            ppvAccountId: this.appConfig.defaultPpvAccountId(),
          },
        );

        const glResult = accountingStrategy.onSupplierReturn({
          amount: Number(totalValueReturned.toFixed(2)),
          memo: `Supplier Return ${ret.returnNumber}`,
          partyType: 'supplier',
          partyId: po.vendorId || undefined,
        });

        if (glResult) {
          await this.glService.postJournalEntry(
            glResult.lines,
            {
              actor,
              entryDate: new Date().toISOString().slice(0, 10),
              sourceType: glResult.sourceType,
              sourceId: returnId,
              memo: `Supplier Return ${ret.returnNumber}`,
            },

            tx as unknown as DrizzleDB,
          );
        }
      }

      // 5. Evaluate PO Lifecycle Engine for Reversal
      await evaluatePOLifecycleRules(
        tx as unknown as DrizzleDB,
        po.purchaseOrderId,
        {
          entity: 'purchase_return',
          action: 'shipped',
          id: returnId,
        },
        actor,
      );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: po.orderNumber,
        payload: {
          entity: 'return',
          entityId: returnId,
          returnNumber: ret.returnNumber,
          from: ret.stateCode,
          to: PURCHASE_RETURN_STATE.SHIPPED,
        },
        actor,
      });

      return updated;
    });

    return result;
  }

  async unshipReturn(returnId: string, actor: string) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (ret.stateCode !== PURCHASE_RETURN_STATE.SHIPPED) {
      throw new BadRequestException(
        'Return must be in SHIPPED state to be unshipped',
      );
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    const returnLines = await this.db
      .select()
      .from(purchaseOrderReturnLines)
      .where(eq(purchaseOrderReturnLines.returnId, returnId));

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      // 1. Re-add stock back into SUPPLIER_RETURNS bin
      if (po.deliveryLocationId && returnLines.length > 0) {
        const [supplierReturnsBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(bins.binNumber, 'SUPPLIER_RETURNS'),
              eq(zones.locationId, po.deliveryLocationId),
            ),
          )
          .limit(1);

        const poLineIds = returnLines.map((rl) => rl.purchaseOrderLineId);
        const orderLineRows =
          poLineIds.length > 0
            ? await tx
                .select()
                .from(purchaseOrderLineItems)
                .where(
                  inArray(
                    purchaseOrderLineItems.purchaseOrderLineId,
                    poLineIds,
                  ),
                )
            : [];

        const orderLinesMap = new Map(
          orderLineRows.map((ol) => [ol.purchaseOrderLineId, ol]),
        );

        if (supplierReturnsBin) {
          for (const rl of returnLines) {
            const orderLine = orderLinesMap.get(rl.purchaseOrderLineId);

            if (!orderLine || !orderLine.productId) {
              throw new BadRequestException(
                `Purchase order line not found for return line ${rl.returnLineId}`,
              );
            }
            const qty = parseFloat(rl.quantityReturned || '0');
            if (qty <= 0) {
              throw new BadRequestException(
                `Invalid quantity returned for return line ${rl.returnLineId}`,
              );
            }

            const newQtyReceived = (
              parseFloat(orderLine.quantityReceived || '0') + qty
            ).toString();

            await tx
              .update(purchaseOrderLineItems)
              .set({ quantityReceived: newQtyReceived })
              .where(
                eq(
                  purchaseOrderLineItems.purchaseOrderLineId,
                  rl.purchaseOrderLineId,
                ),
              );

            const movementNumber = `MOV-${Date.now()}`;
            await this.inventoryMovementService.recordInventoryMovement(tx, {
              entryNumber: movementNumber,
              sourceType: 'PURCHASE_RETURN_UNSHIP',
              sourceId: returnId,
              userId: actor,
              lines: [
                {
                  productId: orderLine.productId,
                  binId: supplierReturnsBin.binId,
                  quantity: qty,
                  uomCode: orderLine.unitOfMeasure || 'EA',
                },
              ],
            });
          }
        }
      }

      // 2. Mark shipment record as cancelled
      await this.changePurchaseReturnShipmentState(
        returnId,
        PURCHASE_RETURN_SHIPMENT_STATE.CANCELLED,
        actor,
        tx,
      );

      // 3. Change state to STAGED
      const updated = await this.changePurchaseReturnState(
        returnId,
        PURCHASE_RETURN_STATE.STAGED,
        actor,
        tx,
      );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: po.orderNumber,
        payload: {
          entity: 'return',
          entityId: returnId,
          returnNumber: ret.returnNumber,
          from: ret.stateCode,
          to: PURCHASE_RETURN_STATE.STAGED,
        },
        actor,
      });

      return updated;
    });

    return result;
  }

  async changePurchaseReturnState(
    returnId: string,
    newState: PurchaseReturnState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;

    if (!VALID_RETURN_STATES.includes(newState)) {
      throw new BadRequestException(
        `Invalid purchase return state: '${newState}'`,
      );
    }

    const [ret] = await db
      .select({ stateCode: purchaseOrderReturns.stateCode })
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId));

    if (!ret) {
      throw new NotFoundException(`Purchase Return ${returnId} not found`);
    }

    const allowed = PURCHASE_RETURN_TRANSITIONS[ret.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition purchase return from '${ret.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await db
      .update(purchaseOrderReturns)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .returning();

    if (updated) {
      await emitEvent(db, {
        entityType: EntityType.PURCHASE_RETURN,
        entityId: returnId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: updated.returnNumber,
        payload: {
          from: ret.stateCode,
          to: newState,
        },
        actor,
      });
    }

    return updated;
  }

  // @herobm-skip-audit - Internal helper updating shipment record state within active return workflows
  async changePurchaseReturnShipmentState(
    returnId: string,
    newState: PurchaseReturnShipmentState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const db = tx || this.db;
    const [updated] = await db
      .update(purchaseOrderReturnShipments)
      .set({ stateCode: newState })
      .where(eq(purchaseOrderReturnShipments.returnId, returnId))
      .returning();
    return updated;
  }
}
