import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrderReceptions,
  purchaseOrderReceptionLines,
  purchaseOrders,
  purchaseOrderLineItems,
  products,
  outbox,
  bins,
  zones,
} from '../drizzle/modbm-core-schema';
import { eq, or, and, ilike, desc, inArray, sql } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { AppConfigService } from '../settings/app-config.service';
import { getValuationStrategy } from '../inventory/valuation';
import { InventoryService } from '../inventory/inventory.service';

@Injectable()
export class ReceptionsService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private appConfig: AppConfigService,
    private readonly inventoryService: InventoryService,
  ) {}

  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      const method = this.appConfig.valuationMethod();
      const strategy = getValuationStrategy(method);

      // Create Reception
      const receptionNumber = `REC-${randomUUID().substring(0, 8).toUpperCase()}`;

      const [reception] = await tx
        .insert(purchaseOrderReceptions)
        .values({
          receptionNumber,
          purchaseOrderId: createDto.purchaseOrderId,
          packingSlipNumber: createDto.packingSlipNumber,
          notes: createDto.notes,
          stateCode: 'received', // hardcoded to handled for now
          createdBy: userId,
        })
        .returning();

      // Create lines
      if (createDto.lines && createDto.lines.length > 0) {
        const lineValues = createDto.lines.map((line: any) => ({
          receptionId: reception.receptionId,
          purchaseOrderLineId: line.purchaseOrderLineId,
          quantityReceived: line.quantityReceived.toString(),
        }));

        await tx.insert(purchaseOrderReceptionLines).values(lineValues);

        const ledgerLines = [];

        // Update PO Line received quantities
        for (const line of createDto.lines) {
          const [poLine] = await tx
            .select()
            .from(purchaseOrderLineItems)
            .where(
              eq(
                purchaseOrderLineItems.purchaseOrderLineId,
                line.purchaseOrderLineId,
              ),
            );

          if (poLine && poLine.productId) {
            const newTotal =
              Number(poLine.quantityReceived) + Number(line.quantityReceived);

            // Get product to calculate new WAC/Standard cost
            const [productRow] = await tx
              .select()
              .from(products)
              .where(eq(products.productId, poLine.productId));

            if (productRow) {
              const poLinePrice = poLine.pricePerUnit || '0';
              const receivedQty = Number(line.quantityReceived);

              const valuation = strategy.onGoodsReceipt(
                {
                  productId: productRow.productId,
                  standardCost: productRow.standardCost || '0',
                  weightedAverageCost: productRow.weightedAverageCost || '0',
                  quantityOnHand: productRow.quantityOnHand || '0',
                },
                receivedQty,
                poLinePrice,
              );

              ledgerLines.push({
                productId: productRow.productId,
                quantity: receivedQty,
              });

              // Update product costs and global QOH
              await tx
                .update(products)
                .set({
                  weightedAverageCost: valuation.newWeightedAverageCost,
                  quantityOnHand: valuation.newQuantityOnHand,
                  modifiedOn: new Date(),
                })
                .where(eq(products.productId, productRow.productId));

              // Record event for general ledger mapping & sync
              await tx.insert(outbox).values({
                aggregateType: 'purchase_order',
                aggregateId: createDto.purchaseOrderId,
                eventType: 'goods_received',
                payload: {
                  receptionId: reception.receptionId,
                  receptionNumber: reception.receptionNumber,
                  productId: productRow.productId,
                  quantityReceived: receivedQty,
                  unitCost: poLinePrice,
                  inventoryValueAdded: valuation.inventoryValueAdded,
                  purchasePriceVariance: valuation.purchasePriceVariance,
                  newWeightedAverageCost: valuation.newWeightedAverageCost,
                },
              });
            }

            await tx
              .update(purchaseOrderLineItems)
              .set({ quantityReceived: newTotal.toString() })
              .where(
                eq(
                  purchaseOrderLineItems.purchaseOrderLineId,
                  line.purchaseOrderLineId,
                ),
              );
          }
        }

        // Check if all PO lines are fully received, update PO status if so
        // For simplicity, just marking the PO as 'received' if a reception is created
        await tx
          .update(purchaseOrders)
          .set({ stateCode: 'received', modifiedOn: new Date() })
          .where(eq(purchaseOrders.purchaseOrderId, createDto.purchaseOrderId));

        if (ledgerLines.length > 0) {
          const [po] = await tx
            .select({ deliveryLocationId: purchaseOrders.deliveryLocationId })
            .from(purchaseOrders)
            .where(
              eq(purchaseOrders.purchaseOrderId, createDto.purchaseOrderId),
            )
            .limit(1);

          let dockBin;
          if (po && po.deliveryLocationId) {
            const result = await tx
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
            dockBin = result[0];
          }

          if (!dockBin) {
            // Fallback for POs with missing delivery locations
            const result = await tx
              .select({ binId: bins.binId })
              .from(bins)
              .where(eq(bins.binNumber, 'RECEIVING'))
              .limit(1);
            dockBin = result[0];
          }

          if (!dockBin) {
            throw new NotFoundException('System RECEIVING bin is missing.');
          }

          const resolvedLedgerLines = ledgerLines.map((l) => ({
            ...l,
            binId: dockBin.binId,
          }));

          await this.inventoryService.recordInventoryMovement(tx, {
            entryNumber:
              'REC-' +
              reception.receptionNumber +
              '-' +
              Date.now().toString().slice(-4),
            sourceType: 'PO_RECEPTION',
            sourceId: reception.receptionId,
            memo: 'Goods Received',
            userId: userId,
            lines: resolvedLedgerLines,
          });
        }
      }

      return this.findOne(reception.receptionId, tx);
    });
  }

  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm, includeArchived } =
      parsePagination(params);

    const searchCondition = searchTerm
      ? or(
          ilike(purchaseOrderReceptions.receptionNumber, searchTerm),
          ilike(purchaseOrderReceptions.packingSlipNumber, searchTerm),
        )
      : undefined;

    const stateCondition = includeArchived
      ? undefined
      : sql`${purchaseOrderReceptions.stateCode} != 'archived'`;

    const conditions = and(searchCondition, stateCondition);

    const data = await this.db
      .select({
        reception: purchaseOrderReceptions,
        purchaseOrder: purchaseOrders,
      })
      .from(purchaseOrderReceptions)
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderReceptions.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .where(conditions)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(purchaseOrderReceptions.createdOn));

    const [{ count }] = await this.db
      .select({ count: this.db.$count(purchaseOrderReceptions, conditions) })
      .from(purchaseOrderReceptions);

    return {
      data: data.map((d: any) => ({
        ...d.reception,
        purchaseOrderNumber: d.purchaseOrder?.orderNumber,
        vendorId: d.purchaseOrder?.vendorId,
      })),
      page,
      limit,
      total: Number(count),
    };
  }

  async findOne(id: string, tx: any = this.db) {
    const reception = await tx
      .select()
      .from(purchaseOrderReceptions)
      .where(eq(purchaseOrderReceptions.receptionId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!reception) {
      throw new NotFoundException(`Reception ${id} not found`);
    }

    const lines = await tx
      .select({
        receptionLineId: purchaseOrderReceptionLines.receptionLineId,
        purchaseOrderLineId: purchaseOrderReceptionLines.purchaseOrderLineId,
        quantityReceived: purchaseOrderReceptionLines.quantityReceived,
        productId: purchaseOrderLineItems.productId,
        productDescription: purchaseOrderLineItems.productDescription,
      })
      .from(purchaseOrderReceptionLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseOrderReceptionLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .where(eq(purchaseOrderReceptionLines.receptionId, id));

    return {
      ...reception,
      lines,
    };
  }
}
