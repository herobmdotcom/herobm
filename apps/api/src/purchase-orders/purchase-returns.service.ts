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
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType } from '../common/event-types';
import { InventoryService } from '../inventory/inventory.service';
import { CreatePurchaseReturnDto } from './dto';
import { AppConfigService } from '../settings/app-config.service';
import { getValuationStrategy } from '../inventory/valuation';

@Injectable()
export class PurchaseReturnsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly appConfig: AppConfigService,
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
      order.stateCode !== 'received' &&
      order.stateCode !== 'partially_received' &&
      order.stateCode !== 'invoiced'
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
          stateCode: 'draft',
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
        eventType: 'return_created',
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
    if (ret.stateCode === 'processed' || ret.stateCode === 'completed') {
      throw new BadRequestException('Return is already processed');
    }

    const [po] = await this.db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, ret.purchaseOrderId))
      .limit(1);

    // deduct inventory
    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(purchaseOrderReturns)
        .set({ stateCode: 'processed', modifiedOn: new Date() })
        .where(eq(purchaseOrderReturns.returnId, returnId))
        .returning();

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
      const strategy = getValuationStrategy(method);

      for (const line of stockLines) {
        if (!line.productId) continue;
        const [product] = await tx
          .select()
          .from(coreProducts)
          .where(eq(coreProducts.productId, line.productId));

        if (product) {
          // Returning removes qty from stock.
          const updatedProduct = strategy.onDispatch(
            {
              productId: product.productId,
              standardCost: product.standardCost || '0',
              weightedAverageCost: product.weightedAverageCost || '0',
              quantityOnHand: product.quantityOnHand || '0',
            },
            parseFloat(line.quantity),
          );

          await tx
            .update(coreProducts)
            .set({
              quantityOnHand: updatedProduct.quantityOnHand,
              modifiedOn: new Date(),
            })
            .where(eq(coreProducts.productId, product.productId));
        }
      }

      await tx.insert(purchaseOrderEvents).values({
        purchaseOrderId: po.purchaseOrderId,
        eventType: 'return_processed',
        actor,
        payload: { returnId, returnNumber: ret.returnNumber },
      });

      return updated;
    });

    return result;
  }
}
