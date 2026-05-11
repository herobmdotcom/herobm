import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderReturns,
  purchaseOrderReturnLines,
  purchaseOrderEvents,
  bins,
  zones,
  products as coreProducts,
  suppliers,
  supplierGroups,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseReturnDto } from './dto';
import {
  PURCHASE_RETURN_STATE,
  PURCHASE_RETURN_TRANSITIONS,
  PURCHASE_ORDER_STATE,
  getValidStates,
} from '@modbm/shared';
import { AppConfigService } from '../settings/app-config.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { GlService } from '../gl/gl.service';

const VALID_RETURN_STATES = getValidStates(PURCHASE_RETURN_TRANSITIONS);

@Injectable()
export class PurchaseReturnsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
  ) {}

  private readonly logger = new Logger(PurchaseReturnsService.name);

  private async generateReturnNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PRT-${today}-`;

    const result = await this.db
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
      }));

      if (lineValues.length > 0) {
        await tx.insert(purchaseOrderReturnLines).values(lineValues);
      }

      await tx.insert(purchaseOrderEvents).values({
        purchaseOrderId,
        eventType: EventType.RETURN_CREATED,
        actor,
        payload: { returnId: ret.returnId, returnNumber },
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

    const result = [];
    for (const ret of returns) {
      const lines = await this.db
        .select()
        .from(purchaseOrderReturnLines)
        .where(eq(purchaseOrderReturnLines.returnId, ret.returnId));
      result.push({ ...ret, lines });
    }

    return result;
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

  async actionReturn(returnId: string, actor: string) {
    const [ret] = await this.db
      .select()
      .from(purchaseOrderReturns)
      .where(eq(purchaseOrderReturns.returnId, returnId))
      .limit(1);

    if (!ret) throw new NotFoundException('Return not found');
    if (ret.stateCode === PURCHASE_RETURN_STATE.PROCESSED) {
      throw new BadRequestException('Return is already processed');
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    // deduct inventory
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const updated = await this.changePurchaseReturnState(
        returnId,
        PURCHASE_RETURN_STATE.PROCESSED,
        actor,
        tx,
      );

      const returnLines = await tx
        .select()
        .from(purchaseOrderReturnLines)
        .where(eq(purchaseOrderReturnLines.returnId, returnId));

      const stockLines = [];
      for (const rl of returnLines) {
        const [orderLine] = await tx
          .select()
          .from(purchaseOrderLineItems)
          .where(
            eq(
              purchaseOrderLineItems.purchaseOrderLineId,
              rl.purchaseOrderLineId,
            ),
          )
          .limit(1);

        if (orderLine) {
          stockLines.push({
            productId: orderLine.productId,
            quantity: rl.quantityReturned,
          });
        }
      }

      if (po.deliveryLocationId) {
        const [dockBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(bins.binNumber, 'RECEIVING'),
              eq(zones.locationId, po.deliveryLocationId),
            ),
          )
          .limit(1);

        if (dockBin) {
          const validStockLines = stockLines.filter(
            (l) => l.productId != null,
          ) as { productId: string; quantity: string }[];
          const moveLines = validStockLines.map((line) => ({
            productId: line.productId,
            binId: dockBin.binId,
            quantity: -parseFloat(line.quantity), // negative quantity for removing from inventory
          }));

          if (moveLines.length > 0) {
            await this.inventoryService.recordInventoryMovement(tx, {
              entryNumber:
                'PRT-' +
                ret.returnNumber +
                '-' +
                Date.now().toString().slice(-4),
              sourceType: 'PO_RETURN',
              sourceId: returnId,
              memo: 'Return to Supplier',
              userId: actor,
              lines: moveLines,
            });
          }
        }
      }

      // Decrement PO quantity Received
      for (const rl of returnLines) {
        await tx.execute(
          sql`UPDATE modbm_core.purchase_order_lines SET quantity_received = (quantity_received::numeric - ${rl.quantityReturned}::numeric) WHERE purchase_order_line_id = ${rl.purchaseOrderLineId}`,
        );
      }

      const method = this.appConfig.valuationMethod();
      const valuationStrategy = getValuationStrategy(method);
      let totalReturnCost = 0;

      for (const line of stockLines) {
        if (!line.productId) continue;
        const [product] = await tx
          .select()
          .from(coreProducts)
          .where(eq(coreProducts.productId, line.productId));

        if (product) {
          const cost = valuationStrategy.getCogs(
            {
              productId: product.productId,
              standardCost: product.standardCost || '0',
              weightedAverageCost: product.weightedAverageCost || '0',
            },
            Math.abs(parseFloat(line.quantity)),
          );
          totalReturnCost += parseFloat(cost);
        }
      }

      // --- Financial Integration: Post Supplier Return GL via Accounting Strategy ---
      const accountingStrategy = getAccountingStrategy(
        this.appConfig.inventoryAccountingMode(),
        {
          inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
          grniAccountId: this.appConfig.defaultGrniAccountId(),
          cogsAccountId: this.appConfig.defaultCogsAccountId(),
          shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
        },
      );

      // Resolve supplier group dimensions for return posting
      let suppCostCenterId: string | undefined;
      let suppActivityId: string | undefined;
      if (po.vendorId) {
        const [supp] = await tx
          .select({
            costCenterId: supplierGroups.defaultCostCenterId,
            activityId: supplierGroups.defaultActivityId,
          })
          .from(suppliers)
          .leftJoin(
            supplierGroups,
            eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
          )
          .where(eq(suppliers.vendorId, po.vendorId));
        if (supp) {
          suppCostCenterId = supp.costCenterId || undefined;
          suppActivityId = supp.activityId || undefined;
        }
      }

      const supplierReturnGl = accountingStrategy.onSupplierReturn({
        amount: Number(totalReturnCost.toFixed(2)),
        memo: `Supplier Return ${ret.returnNumber}`,
        partyType: 'supplier',
        partyId: po.vendorId || undefined,
        costCenterId: suppCostCenterId,
        activityId: suppActivityId,
      });

      if (supplierReturnGl) {
        await this.glService.postJournalEntry(
          supplierReturnGl.lines as any,
          {
            actor,
            entryDate: new Date().toISOString().slice(0, 10),
            sourceType: supplierReturnGl.sourceType,
            sourceId: returnId,
            memo: `Supplier Return ${ret.returnNumber}`,
          },
          tx,
        );
      }

      await emitEvent(tx as any, {
        aggregateType: AggregateType.PURCHASE_ORDER,
        aggregateId: po.purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        payload: {
          entity: 'return',
          entityId: returnId,
          returnNumber: ret.returnNumber,
          from: ret.stateCode,
          to: PURCHASE_RETURN_STATE.PROCESSED,
        },
        actor,
      });

      return updated;
    });

    return result;
  }

  /**
   * Universal changeState for Purchase Returns
   */
  async changePurchaseReturnState(
    returnId: string,
    newState: string,
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

    return updated;
  }
}
