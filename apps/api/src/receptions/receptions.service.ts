import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrderReceptions,
  purchaseOrderReceptionLines,
  purchaseOrders,
  purchaseOrderLineItems,
  purchaseOrderEvents,
  products,
  outbox,
  bins,
  zones,
  locations,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
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

      const [po] = await tx
        .select({
          stateCode: purchaseOrders.stateCode,
          deliveryLocationId: purchaseOrders.deliveryLocationId,
        })
        .from(purchaseOrders)
        .where(eq(purchaseOrders.purchaseOrderId, createDto.purchaseOrderId))
        .limit(1);

      if (!po) {
        throw new NotFoundException('Purchase order not found');
      }

      if (po.stateCode !== 'ordered' && po.stateCode !== 'partially_received') {
        throw new BadRequestException(
          'Receptions can only be created for ordered or partially received purchase orders',
        );
      }

      // Resolve receiving bin in the selected location
      const result = await tx
        .select({
          binId: bins.binId,
          binName: bins.binNumber, // the original name of bin string is binNumber
          zoneName: zones.name,
          locationName: locations.name,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .innerJoin(locations, eq(zones.locationId, locations.locationId))
        .where(
          and(
            eq(bins.binNumber, 'RECEIVING'),
            eq(zones.locationId, createDto.locationId),
          ),
        )
        .limit(1);

      const dockBin = result[0];
      if (!dockBin) {
        throw new BadRequestException(
          `The selected location does not have a RECEIVING bin.`,
        );
      }

      // Move location_discrepancy_warning AFTER reception creation so we have receptionId

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

      // Check Location Discrepancy
      if (
        po.deliveryLocationId &&
        po.deliveryLocationId !== createDto.locationId
      ) {
        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: createDto.purchaseOrderId,
          eventType: EventType.LOCATION_DISCREPANCY_WARNING,
          payload: {
            expectedLocationId: po.deliveryLocationId,
            receivedLocationId: createDto.locationId,
            receptionId: reception.receptionId,
          },
          actor: userId,
        });
      }

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

            if (newTotal > Number(poLine.quantity)) {
              await emitEvent(tx, {
                aggregateType: AggregateType.PURCHASE_ORDER,
                aggregateId: createDto.purchaseOrderId,
                eventType: EventType.OVER_RECEIVED_WARNING,
                payload: {
                  purchaseOrderLineId: poLine.purchaseOrderLineId,
                  productId: poLine.productId,
                  orderedQuantity: Number(poLine.quantity),
                  newTotalReceived: newTotal,
                  receptionId: reception.receptionId,
                },
                actor: userId,
              });
            }

            if (
              line.invoicePricePerUnit !== undefined &&
              Number(line.invoicePricePerUnit) !== Number(poLine.pricePerUnit)
            ) {
              await emitEvent(tx, {
                aggregateType: AggregateType.PURCHASE_ORDER,
                aggregateId: createDto.purchaseOrderId,
                eventType: EventType.PRICE_DISCREPANCY_WARNING,
                payload: {
                  purchaseOrderLineId: poLine.purchaseOrderLineId,
                  productId: poLine.productId,
                  poPrice: Number(poLine.pricePerUnit),
                  invoicePrice: Number(line.invoicePricePerUnit),
                  receptionId: reception.receptionId,
                },
                actor: userId,
              });
            }

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

              // Record unified event (writes to audit + outbox)
              await emitEvent(tx, {
                aggregateType: AggregateType.PURCHASE_ORDER,
                aggregateId: createDto.purchaseOrderId,
                eventType: EventType.GOODS_RECEIVED,
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
                actor: userId,
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
        const allPoLines = await tx
          .select({
            quantity: purchaseOrderLineItems.quantity,
            quantityReceived: purchaseOrderLineItems.quantityReceived,
          })
          .from(purchaseOrderLineItems)
          .where(
            eq(
              purchaseOrderLineItems.purchaseOrderId,
              createDto.purchaseOrderId,
            ),
          );

        let isFullyReceived = true;
        for (const l of allPoLines) {
          if (Number(l.quantityReceived) < Number(l.quantity)) {
            isFullyReceived = false;
            break;
          }
        }

        const [existingPo] = await tx
          .select({ stateCode: purchaseOrders.stateCode })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, createDto.purchaseOrderId));

        const newState = isFullyReceived ? 'received' : 'partially_received';

        if (existingPo && existingPo.stateCode !== newState) {
          await tx
            .update(purchaseOrders)
            .set({ stateCode: newState, modifiedOn: new Date() })
            .where(
              eq(purchaseOrders.purchaseOrderId, createDto.purchaseOrderId),
            );

          await emitEvent(tx, {
            aggregateType: AggregateType.PURCHASE_ORDER,
            aggregateId: createDto.purchaseOrderId,
            eventType: EventType.STATUS_CHANGED,
            payload: {
              from: existingPo.stateCode,
              to: newState,
            },
            actor: userId,
          });
        }

        if (ledgerLines.length > 0) {
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

      const record = await this.findOne(reception.receptionId, tx);
      return {
        ...record,
        destination: {
          locationName: dockBin.locationName,
          zoneName: dockBin.zoneName,
          binName: dockBin.binName,
        },
      };
    });
  }

  async findAll(params: PaginationQuery, purchaseOrderId?: string) {
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

    const poCondition = purchaseOrderId
      ? eq(purchaseOrderReceptions.purchaseOrderId, purchaseOrderId)
      : undefined;

    const conditions = and(searchCondition, stateCondition, poCondition);

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
