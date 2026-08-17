import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import {
  ilike,
  or,
  eq,
  inArray,
  sql,
  and,
  isNull,
  desc,
  asc,
  lte,
} from 'drizzle-orm';
import { AppConfigService } from '../settings/app-config.service';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  inventoryLevels,
  products,
  bins,
  binContents,
  inventoryEntries,
  inventoryLedger,
  outbox,
  zones,
  locations,
  salesOrders,
  salesOrderShipments,
  salesOrderReturns,
  salesOrderReturnLines,
  salesOrderLineItems,
  customers,
  purchaseOrders,
  suppliers,
  productUoms,
  productDefaultBins,
  goodsReceived,
  goodsReceivedLines,
  purchaseOrderLineItems,
  transferOrders,
  transferOrderReceipts,
  transferOrderReceiptLines,
  actors,
  workOrders,
  backorders,
} from '@herobm/db-schema';
import { randomUUID } from 'crypto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import {
  calculateAvailableQuantity,
  MATCH_STATUS,
  PUTAWAY_STATUS,
  RETURN_STATE,
  BACKORDER_STATE,
} from '@herobm/shared';
import {
  isPickableBinSqlCondition,
  filterPickableBins,
  calculatePickableOnHand,
  isQuarantineBinCondition,
} from './inventory-math.utils';
import { BIN_TYPE } from '@herobm/shared';
import { UomService } from './uom.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from './valuation';
import { getAccountingStrategy } from './inventory-accounting';

@Injectable()
export class InventoryMovementService {
  private readonly logger = new Logger(InventoryMovementService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private appConfig: AppConfigService,
    private uomService: UomService,
    private glService: GlService,
  ) {}

  // =========================================================================
  // Read-only queries (from inventory_levels view / bin_contents cache)
  // =========================================================================
  // ── Ledger Mutations (Modern Approach) ───────────────────────────────

  /**
   * Record a strictly balanced inventory movement in the immutable ledger.
   * This creates a header (inventory_entries), the ledger lines (inventory_ledger),
   * updates the cache (bin_contents), and emits an outbox event.
   */
  async recordInventoryMovement(
    tx: Parameters<Parameters<DrizzleDB['transaction']>[0]>[0] | DrizzleDB,
    params: {
      entryNumber: string;
      sourceType: string;
      sourceId?: string;
      memo?: string;
      userId?: string;
      lines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string; // <-- strictly required
      }[];
    },
  ) {
    if (params.lines.length === 0) return;

    // 1. Prepare absolute base quantities for all input lines
    const processedLines = [];
    for (const line of params.lines) {
      const absoluteQty = await this.uomService.calculateAbsoluteBaseQuantity(
        line.productId,
        [{ quantity: line.quantity, uomCode: line.uomCode }],
        tx,
      );
      processedLines.push({ ...line, absoluteQuantity: absoluteQty });
    }

    // 2. Create Header
    const [entry] = await tx
      .insert(inventoryEntries)
      .values({
        entryNumber: params.entryNumber,
        sourceType: params.sourceType,
        sourceId: params.sourceId,
        memo: params.memo,
        createdBy: params.userId,
        isReversed: false,
      })
      .returning({ entryId: inventoryEntries.entryId });

    // 1b. Resolve Zone and Location for all bins
    const binIds = [...new Set(params.lines.map((l) => l.binId))];
    const resolvedBins = await tx
      .select()
      .from(bins)
      .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
      .where(inArray(bins.binId, binIds));

    const binMap = new Map<
      string,
      { binId: string; locationId: string | null; zoneId: string | null }
    >(
      resolvedBins.map((row) => {
        const b = row.bins;
        const z = row.zones;
        return [b.binId, { ...b, locationId: z.locationId }];
      }),
    );

    // 2. Create Ledger Lines
    const ledgerPayload = processedLines.map((l) => {
      const b = binMap.get(l.binId);
      if (!b) throw new Error(`Bin ${l.binId} not found in database`);
      return {
        entryId: entry.entryId,
        productId: l.productId,
        binId: l.binId,
        locationId: b.locationId as string,
        zoneId: b.zoneId as string,
        quantity: l.absoluteQuantity.toString(),
      };
    });
    await tx.insert(inventoryLedger).values(ledgerPayload);

    // 4. Update Cache (bin_contents)
    for (const line of processedLines) {
      await tx
        .insert(binContents)
        .values({
          binId: line.binId,
          productId: line.productId,
          actualQuantity: line.absoluteQuantity.toString(),
          modifiedOn: new Date(),
        })
        .onConflictDoUpdate({
          target: [binContents.binId, binContents.productId],
          set: {
            actualQuantity: sql`${binContents.actualQuantity} + ${line.absoluteQuantity.toString()}`,
            modifiedOn: new Date(),
          },
        });
    }

    // 5. Cleanup Zero Quantity Cache Entries
    for (const line of processedLines) {
      await tx
        .delete(binContents)
        .where(
          and(
            eq(binContents.binId, line.binId),
            eq(binContents.productId, line.productId),
            lte(sql`${binContents.actualQuantity}::numeric`, 0),
          ),
        );
    }

    // --- Financial Integration: Post Shrinkage Journal Entry via Accounting Strategy ---
    if (params.sourceType === 'MANUAL_ADJUST') {
      const productIds = [...new Set(processedLines.map((l) => l.productId))];
      if (productIds.length > 0) {
        const productRows = await tx
          .select({
            productId: products.productId,
            standardCost: products.standardCost,
            weightedAverageCost: products.weightedAverageCost,
          })
          .from(products)
          .where(inArray(products.productId, productIds));

        const productMap = new Map<
          string,
          {
            productId: string;
            standardCost: string | null;
            weightedAverageCost: string | null;
          }
        >(productRows.map((p) => [p.productId, p]));
        const valuationStrategy = getValuationStrategy(
          this.appConfig.valuationMethod(),
        );

        let totalShrinkageValue = 0; // Positive means we lost inventory (expense), Negative means we gained inventory (income)

        for (const line of processedLines) {
          const p = productMap.get(line.productId);
          if (p) {
            const cost = valuationStrategy.getCogs(
              {
                productId: p.productId,
                standardCost: p.standardCost || '0',
                weightedAverageCost: p.weightedAverageCost || '0',
              },
              Math.abs(line.absoluteQuantity),
            );

            if (line.absoluteQuantity > 0) {
              totalShrinkageValue -= parseFloat(cost); // Gained inventory
            } else if (line.absoluteQuantity < 0) {
              totalShrinkageValue += parseFloat(cost); // Lost inventory
            }
          }
        }

        if (Math.abs(totalShrinkageValue) > 0.001) {
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

          const direction = totalShrinkageValue > 0 ? 'loss' : 'gain';
          const adjustmentGl = accountingStrategy.onManualAdjustment(
            {
              amount: Number(Math.abs(totalShrinkageValue).toFixed(2)),
              memo: `Manual Adjustment ${params.entryNumber}`,
            },
            direction,
          );

          if (adjustmentGl) {
            await this.glService.postJournalEntry(
              adjustmentGl.lines as Parameters<
                GlService['postJournalEntry']
              >[0],
              {
                actor: params.userId || 'system',
                entryDate: new Date().toISOString().slice(0, 10),
                sourceType: adjustmentGl.sourceType,
                sourceId: entry.entryId,
                memo:
                  params.memo || `Inventory Adjustment ${params.entryNumber}`,
              },
              tx,
            );
          }
        }
      }
    }

    // 4. Emit event for ERP sync (and system events audit)
    await emitEvent(tx, {
      entityType: EntityType.INVENTORY_LEDGER,
      entityId: entry.entryId,
      eventType: EventType.ENTRY_POSTED,
      entityDisplayName: params.entryNumber,
      payload: { header: params, lines: ledgerPayload },
    });
  }

  // ── Putaway Queue (Polymorphic) ──────────────────────────────────────

  async putaway(dto: import('./dto').PutawayBulkDto, userId: string) {
    return await this.db.transaction(async (tx) => {
      for (const lineDto of dto.putaways) {
        let locationId: string;
        let productId: string;
        let putawayStatus: string;
        let sourceBinCode: string;
        let referenceNumber: string;
        let recordSourceType: string;
        let recordSourceId: string;
        let linePrefix: string;
        let uomCode: string;

        if (lineDto.sourceType === 'goods_receipt') {
          const [grLine] = await tx
            .select({
              line: goodsReceivedLines,
              locationId: goodsReceived.locationId,
              receiptNumber: goodsReceived.receiptNumber,
              uomCode: purchaseOrderLineItems.unitOfMeasure,
              baseUom: products.baseUom,
            })
            .from(goodsReceivedLines)
            .innerJoin(
              goodsReceived,
              eq(
                goodsReceivedLines.goodsReceivedId,
                goodsReceived.goodsReceivedId,
              ),
            )
            .leftJoin(
              purchaseOrderLineItems,
              eq(
                goodsReceivedLines.purchaseOrderLineId,
                purchaseOrderLineItems.purchaseOrderLineId,
              ),
            )
            .leftJoin(
              products,
              eq(goodsReceivedLines.productId, products.productId),
            )
            .where(eq(goodsReceivedLines.goodsReceivedLineId, lineDto.lineId))
            .limit(1);

          if (!grLine)
            throw new NotFoundException(`Line ${lineDto.lineId} not found`);
          if (grLine.line.matchStatus !== MATCH_STATUS.MATCHED) {
            throw new BadRequestException(
              `Cannot putaway unmatched line: ${lineDto.lineId}`,
            );
          }

          locationId = grLine.locationId;
          productId = grLine.line.productId;
          putawayStatus = grLine.line.putawayStatus;
          referenceNumber = grLine.receiptNumber;
          recordSourceType = 'PO_RECEIPT';
          recordSourceId = grLine.line.goodsReceivedId;
          linePrefix = grLine.line.goodsReceivedLineId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : 'RECEIVING';
          uomCode = grLine.uomCode || grLine.baseUom || 'EA';
        } else if (lineDto.sourceType === 'transfer_receipt') {
          const [toLine] = await tx
            .select({
              line: transferOrderReceiptLines,
              locationId: transferOrders.destinationLocationId,
              receiptNumber: transferOrderReceipts.receiptNumber,
              baseUom: products.baseUom,
            })
            .from(transferOrderReceiptLines)
            .innerJoin(
              transferOrderReceipts,
              eq(
                transferOrderReceiptLines.receiptId,
                transferOrderReceipts.receiptId,
              ),
            )
            .innerJoin(
              transferOrders,
              eq(
                transferOrderReceipts.transferOrderId,
                transferOrders.transferOrderId,
              ),
            )
            .leftJoin(
              products,
              eq(transferOrderReceiptLines.productId, products.productId),
            )
            .where(eq(transferOrderReceiptLines.receiptLineId, lineDto.lineId))
            .limit(1);

          if (!toLine)
            throw new NotFoundException(`Line ${lineDto.lineId} not found`);

          locationId = toLine.locationId;
          productId = toLine.line.productId;
          putawayStatus = toLine.line.putawayStatus;
          referenceNumber = toLine.receiptNumber;
          recordSourceType = 'TRANSFER_IN';
          recordSourceId = toLine.line.receiptId;
          linePrefix = toLine.line.receiptLineId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : 'RECEIVING';
          uomCode = toLine.baseUom || 'EA';
        } else if (lineDto.sourceType === 'work_order') {
          const [woLine] = await tx
            .select({
              wo: workOrders,
              productName: products.name,
              productNumber: products.productNumber,
              baseUom: products.baseUom,
              outputBinNumber: bins.binNumber,
            })
            .from(workOrders)
            .innerJoin(products, eq(workOrders.productId, products.productId))
            .leftJoin(
              bins,
              eq(
                sql`COALESCE(${workOrders.outputBinId}, ${workOrders.wipBinId})`,
                bins.binId,
              ),
            )
            .where(eq(workOrders.workOrderId, lineDto.lineId))
            .limit(1);

          if (!woLine)
            throw new NotFoundException(
              `Work Order ${lineDto.lineId} not found`,
            );

          locationId = woLine.wo.locationId;
          productId = woLine.wo.productId;
          putawayStatus =
            woLine.wo.putawayStatus || PUTAWAY_STATUS.PENDING_PUTAWAY;
          referenceNumber = woLine.wo.orderNumber;
          recordSourceType = 'WORK_ORDER';
          recordSourceId = woLine.wo.workOrderId;
          linePrefix = woLine.wo.workOrderId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : woLine.outputBinNumber || 'WIP';
          uomCode = woLine.baseUom || 'EA';
        } else {
          // sales_return
          const [retLine] = await tx
            .select({
              line: salesOrderReturnLines,
              locationId: salesOrders.fulfillmentLocationId,
              returnNumber: salesOrderReturns.returnNumber,
              productId: salesOrderLineItems.productId,
              uomCode: salesOrderLineItems.unitOfMeasure,
            })
            .from(salesOrderReturnLines)
            .innerJoin(
              salesOrderReturns,
              eq(salesOrderReturnLines.returnId, salesOrderReturns.returnId),
            )
            .innerJoin(
              salesOrders,
              eq(salesOrderReturns.salesOrderId, salesOrders.salesOrderId),
            )
            .innerJoin(
              salesOrderLineItems,
              eq(
                salesOrderReturnLines.salesOrderLineId,
                salesOrderLineItems.salesOrderLineId,
              ),
            )
            .where(eq(salesOrderReturnLines.returnLineId, lineDto.lineId))
            .limit(1);

          if (!retLine)
            throw new NotFoundException(
              `Return line ${lineDto.lineId} not found`,
            );

          locationId = retLine.locationId;
          productId = retLine.productId!;
          putawayStatus = retLine.line.putawayStatus;
          referenceNumber = retLine.returnNumber;
          recordSourceType = 'SO_RETURN';
          recordSourceId = retLine.line.returnId;
          linePrefix = retLine.line.returnLineId.substring(0, 4);
          sourceBinCode =
            putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? 'QUARANTINE'
              : 'CUSTOMER_RETURNS';
          uomCode = retLine.uomCode || 'EA';
        }

        if (putawayStatus === PUTAWAY_STATUS.COMPLETED) {
          throw new BadRequestException(
            `Line ${lineDto.lineId} is already putaway`,
          );
        }

        const [sourceBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(zones.locationId, locationId),
              eq(bins.binNumber, sourceBinCode),
            ),
          )
          .limit(1);

        if (!sourceBin) {
          throw new BadRequestException(
            `Source bin ${sourceBinCode} not found for line ${lineDto.lineId}`,
          );
        }

        const qty = parseFloat(lineDto.quantity);

        const movements: {
          productId: string;
          binId: string;
          quantity: number;
          uomCode: string;
        }[] = [
          { productId, binId: sourceBin.binId, quantity: -qty, uomCode },
          {
            productId,
            binId: lineDto.destinationBinId,
            quantity: qty,
            uomCode,
          },
        ];

        // Handle discrepancies
        if (lineDto.newTotalQuantity !== undefined) {
          const newTotal = parseFloat(lineDto.newTotalQuantity);
          const [destBinContent] = await tx
            .select({ actualQuantity: binContents.actualQuantity })
            .from(binContents)
            .where(
              and(
                eq(binContents.productId, productId),
                eq(binContents.binId, lineDto.destinationBinId),
              ),
            )
            .limit(1);

          const currentDbQty = destBinContent
            ? parseFloat(destBinContent.actualQuantity)
            : 0;
          const expectedTotal = currentDbQty + qty;
          const discrepancy = newTotal - expectedTotal;

          if (Math.abs(discrepancy) > 0.001) {
            movements.push({
              productId,
              binId: lineDto.destinationBinId,
              quantity: discrepancy,
              uomCode,
            });
            this.logger.warn(
              `Putaway discrepancy adjustment created. Expected: ${expectedTotal}, Counted: ${newTotal}, Adj: ${discrepancy}`,
            );
          }
        }

        await this.recordInventoryMovement(tx, {
          entryNumber: `PUT-${referenceNumber}-${linePrefix}`,
          sourceType: recordSourceType,
          sourceId: recordSourceId,
          memo: `Putaway to ${lineDto.destinationBinId}`,
          userId,
          lines: movements,
        });

        const [[product], [destBin]] = await Promise.all([
          tx
            .select({ name: products.name })
            .from(products)
            .where(eq(products.productId, productId)),
          tx
            .select({ binNumber: bins.binNumber, binType: bins.binType })
            .from(bins)
            .where(eq(bins.binId, lineDto.destinationBinId)),
        ]);

        const newStatus =
          // eslint-disable-next-line @typescript-eslint/no-unsafe-enum-comparison -- DB enum compared to TS enum
          destBin?.binType === BIN_TYPE.QUARANTINE
            ? PUTAWAY_STATUS.QUARANTINED
            : PUTAWAY_STATUS.COMPLETED;

        // Mark line as completed or quarantined
        if (lineDto.sourceType === 'goods_receipt') {
          await tx
            .update(goodsReceivedLines)
            .set({ putawayStatus: newStatus })
            .where(eq(goodsReceivedLines.goodsReceivedLineId, lineDto.lineId));
        } else if (lineDto.sourceType === 'transfer_receipt') {
          await tx
            .update(transferOrderReceiptLines)
            .set({ putawayStatus: newStatus })
            .where(eq(transferOrderReceiptLines.receiptLineId, lineDto.lineId));
        } else if (lineDto.sourceType === 'work_order') {
          await tx
            .update(workOrders)
            .set({
              putawayStatus: newStatus,
              modifiedOn: new Date(),
            })
            .where(eq(workOrders.workOrderId, lineDto.lineId));

          const linkedBackorders = await tx
            .select({ backorderId: backorders.backorderId })
            .from(backorders)
            .where(eq(backorders.workOrderId, lineDto.lineId));

          for (const bo of linkedBackorders) {
            await tx
              .update(backorders)
              .set({
                // eslint-disable-next-line no-restricted-syntax -- Fulfill backorder
                stateCode: BACKORDER_STATE.FULFILLED,
                modifiedOn: new Date(),
              })
              .where(eq(backorders.backorderId, bo.backorderId));
          }
        } else {
          await tx
            .update(salesOrderReturnLines)
            .set({
              putawayStatus: newStatus,
              ...(lineDto.reason ? { reason: lineDto.reason } : {}),
            })
            .where(eq(salesOrderReturnLines.returnLineId, lineDto.lineId));
        }

        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.WAREHOUSE,
          entityId: lineDto.lineId,
          eventType: EventType.PUTAWAY_COMPLETED,
          entityDisplayName: referenceNumber,
          payload: {
            lineId: lineDto.lineId,
            sourceType: lineDto.sourceType,
            productId,
            productName: product?.name,
            quantityPutaway: lineDto.quantity,
            destinationBinId: lineDto.destinationBinId,
            destinationBinNumber: destBin?.binNumber,
          },
          actor: userId,
        });
      }

      // Check if any returns should be transitioned to RECEIVED automatically
      const affectedReturnIds = Array.from(
        new Set(
          dto.putaways
            .filter((p) => p.sourceType === 'sales_return')
            .map((p) => p.lineId),
        ),
      );

      if (affectedReturnIds.length > 0) {
        for (const lineId of affectedReturnIds) {
          const [rl] = await tx
            .select({ returnId: salesOrderReturnLines.returnId })
            .from(salesOrderReturnLines)
            .where(eq(salesOrderReturnLines.returnLineId, lineId));

          if (rl) {
            const lines = await tx
              .select({ putawayStatus: salesOrderReturnLines.putawayStatus })
              .from(salesOrderReturnLines)
              .where(eq(salesOrderReturnLines.returnId, rl.returnId));

            const allCompleted =
              lines.length > 0 &&
              lines.every((l) => l.putawayStatus === PUTAWAY_STATUS.COMPLETED);

            if (allCompleted) {
              const [ret] = await tx
                .select({
                  stateCode: salesOrderReturns.stateCode,
                  salesOrderId: salesOrderReturns.salesOrderId,
                  returnNumber: salesOrderReturns.returnNumber,
                })
                .from(salesOrderReturns)
                .where(eq(salesOrderReturns.returnId, rl.returnId));

              if (
                ret &&
                ret.stateCode !== RETURN_STATE.RECEIVED &&
                ret.stateCode !== RETURN_STATE.PROCESSED
              ) {
                await this.changeReturnState(
                  tx,
                  rl.returnId,
                  RETURN_STATE.RECEIVED,
                );

                const [order] = await tx
                  .select({ orderNumber: salesOrders.orderNumber })
                  .from(salesOrders)
                  .where(eq(salesOrders.salesOrderId, ret.salesOrderId));
                await emitEvent(tx, {
                  entityType: EntityType.SALES_ORDER,
                  entityId: ret.salesOrderId,
                  eventType: EventType.STATUS_CHANGED,
                  entityDisplayName: order.orderNumber,
                  payload: {
                    entity: 'return',
                    entityId: rl.returnId,
                    from: ret.stateCode,
                    to: RETURN_STATE.RECEIVED,
                    returnNumber: ret.returnNumber,
                    reason: 'Auto-transition from complete putaway',
                  },
                  actor: userId,
                });
              }
            }
          }
        }
      }

      return { success: true };
    });
  }

  async quarantineStock(
    dto: import('./dto').QuarantineMoveDto,
    userId: string,
  ) {
    return await this.db.transaction(async (tx) => {
      let locationId: string;
      let productId = dto.productId;
      let quantityToMove = parseFloat(dto.quantity || '0');
      let currentPutawayStatus: string | undefined;

      // Auto-resolve for line-based actions
      if (dto.lineId && dto.sourceType) {
        let defaultBinCode: string;

        if (dto.sourceType === 'goods_receipt') {
          const [grLine] = await tx
            .select({
              line: goodsReceivedLines,
              locationId: goodsReceived.locationId,
            })
            .from(goodsReceivedLines)
            .innerJoin(
              goodsReceived,
              eq(
                goodsReceivedLines.goodsReceivedId,
                goodsReceived.goodsReceivedId,
              ),
            )
            .where(eq(goodsReceivedLines.goodsReceivedLineId, dto.lineId))
            .limit(1);

          if (!grLine) throw new NotFoundException('Line not found');

          locationId = grLine.locationId;
          productId = productId || grLine.line.productId;
          currentPutawayStatus = grLine.line.putawayStatus;
          if (!dto.quantity)
            quantityToMove = parseFloat(grLine.line.quantityReceived);
          defaultBinCode = 'RECEIVING';
        } else {
          const [retLine] = await tx
            .select({
              line: salesOrderReturnLines,
              locationId: salesOrders.fulfillmentLocationId,
              productId: salesOrderLineItems.productId,
            })
            .from(salesOrderReturnLines)
            .innerJoin(
              salesOrderReturns,
              eq(salesOrderReturnLines.returnId, salesOrderReturns.returnId),
            )
            .innerJoin(
              salesOrders,
              eq(salesOrderReturns.salesOrderId, salesOrders.salesOrderId),
            )
            .innerJoin(
              salesOrderLineItems,
              eq(
                salesOrderReturnLines.salesOrderLineId,
                salesOrderLineItems.salesOrderLineId,
              ),
            )
            .where(eq(salesOrderReturnLines.returnLineId, dto.lineId))
            .limit(1);

          if (!retLine) throw new NotFoundException('Line not found');

          locationId = retLine.locationId;
          productId = productId || retLine.productId!;
          currentPutawayStatus = retLine.line.putawayStatus;
          if (!dto.quantity)
            quantityToMove = parseFloat(retLine.line.quantityReturned);
          defaultBinCode = 'CUSTOMER_RETURNS';
        }

        if (currentPutawayStatus === PUTAWAY_STATUS.COMPLETED) {
          throw new BadRequestException(
            'Cannot quarantine an already putaway line',
          );
        }

        const isCurrentlyQuarantined =
          currentPutawayStatus === PUTAWAY_STATUS.QUARANTINED;

        if (!dto.sourceBinId) {
          const sourceBinCode = isCurrentlyQuarantined
            ? 'QUARANTINE'
            : defaultBinCode;
          const [sBin] = await tx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, locationId),
                eq(bins.binNumber, sourceBinCode),
              ),
            )
            .limit(1);
          if (!sBin)
            throw new BadRequestException(
              `Source bin ${sourceBinCode} not found`,
            );
          dto.sourceBinId = sBin.binId;
        }

        if (!dto.targetBinId) {
          const targetBinCode = isCurrentlyQuarantined
            ? defaultBinCode
            : 'QUARANTINE';
          const [tBin] = await tx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, locationId),
                eq(bins.binNumber, targetBinCode),
              ),
            )
            .limit(1);
          if (!tBin)
            throw new BadRequestException(
              `Target bin ${targetBinCode} not found`,
            );
          dto.targetBinId = tBin.binId;
        }
      }

      if (!dto.sourceBinId)
        throw new BadRequestException('sourceBinId is required');
      if (!productId) throw new BadRequestException('productId is required');
      if (!quantityToMove || quantityToMove <= 0)
        throw new BadRequestException('quantity is required');

      // Fetch source bin
      const [sourceBin] = await tx
        .select({
          binId: bins.binId,
          binType: bins.binType,
          zoneId: bins.zoneId,
          locationId: zones.locationId,
        })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(eq(bins.binId, dto.sourceBinId))
        .limit(1);

      if (!sourceBin) throw new BadRequestException('Source bin not found');

      const isUnquarantining =
        sourceBin.binType === (BIN_TYPE.QUARANTINE as string);

      let targetBinId = dto.targetBinId;

      if (isUnquarantining) {
        if (!targetBinId) {
          throw new BadRequestException(
            'targetBinId is required when moving stock out of quarantine',
          );
        }
        const [targetBin] = await tx
          .select({
            binId: bins.binId,
            binType: bins.binType,
            locationId: zones.locationId,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, targetBinId))
          .limit(1);

        if (!targetBin) throw new BadRequestException('Target bin not found');
        if (targetBin.locationId !== sourceBin.locationId)
          throw new BadRequestException(
            'Target bin must be in the same location',
          );
        if (targetBin.binType === (BIN_TYPE.QUARANTINE as string))
          throw new BadRequestException(
            'Target bin cannot be a quarantine bin when unquarantining',
          );
      } else {
        if (targetBinId) {
          const [targetBin] = await tx
            .select({
              binId: bins.binId,
              binType: bins.binType,
              locationId: zones.locationId,
            })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(eq(bins.binId, targetBinId))
            .limit(1);

          if (!targetBin) throw new BadRequestException('Target bin not found');
          if (targetBin.locationId !== sourceBin.locationId)
            throw new BadRequestException(
              'Target bin must be in the same location',
            );
          if (targetBin.binType !== (BIN_TYPE.QUARANTINE as string))
            throw new BadRequestException(
              'Target bin must be a quarantine type bin',
            );
        } else {
          // Auto-resolve first quarantine bin in location
          const [targetBin] = await tx
            .select({ binId: bins.binId })
            .from(bins)
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(
              and(
                eq(zones.locationId, sourceBin.locationId),
                isQuarantineBinCondition(bins),
              ),
            )
            .limit(1);
          if (!targetBin)
            throw new BadRequestException(
              'No quarantine bin found in this location',
            );
          targetBinId = targetBin.binId;
        }
      }

      // Check available quantity in source bin
      const [binContent] = await tx
        .select({ quantity: binContents.actualQuantity })
        .from(binContents)
        .where(
          and(
            eq(binContents.binId, sourceBin.binId),
            eq(binContents.productId, productId),
          ),
        )
        .limit(1);

      const availableQty = parseFloat(binContent?.quantity || '0');

      if (availableQty < quantityToMove) {
        throw new BadRequestException(
          `Insufficient stock in source bin. Available: ${availableQty}`,
        );
      }

      const reference = dto.lineId
        ? `LINE-${dto.lineId.substring(0, 4)}`
        : `BIN-${sourceBin.binId.substring(0, 4)}`;
      const prefix = isUnquarantining ? 'UNQUAR' : 'QUAR';
      const recordSourceType =
        dto.sourceType === 'goods_receipt'
          ? 'PO_RECEIPT'
          : dto.sourceType === 'sales_return'
            ? 'SO_RETURN'
            : 'MANUAL';
      const recordSourceId = dto.lineId || dto.sourceBinId;

      const [product] = await tx
        .select({ baseUom: products.baseUom })
        .from(products)
        .where(eq(products.productId, productId))
        .limit(1);

      await this.recordInventoryMovement(tx, {
        entryNumber: `${prefix}-${reference}-${randomUUID().substring(0, 8).toUpperCase()}`,
        sourceType: recordSourceType,
        sourceId: recordSourceId,
        memo: `${isUnquarantining ? 'Un-quarantine' : 'Quarantine'} item. Reason: ${dto.reason || 'None'}`,
        userId,
        lines: [
          {
            productId: productId,
            binId: sourceBin.binId,
            quantity: -quantityToMove,
            uomCode: product.baseUom,
          },
          {
            productId: productId,
            binId: targetBinId,
            quantity: quantityToMove,
            uomCode: product.baseUom,
          },
        ],
      });

      const [[productObj], [sourceBinObj], [targetBinObj]] = await Promise.all([
        tx
          .select({ name: products.name })
          .from(products)
          .where(eq(products.productId, productId)),
        tx
          .select({ binNumber: bins.binNumber })
          .from(bins)
          .where(eq(bins.binId, sourceBin.binId)),
        tx
          .select({ binNumber: bins.binNumber })
          .from(bins)
          .where(eq(bins.binId, targetBinId)),
      ]);

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.WAREHOUSE,
        entityId: dto.sourceBinId,
        eventType: EventType.STOCK_MOVED,
        entityDisplayName: reference,
        payload: {
          productId,
          productName: productObj?.name,
          sourceBinId: sourceBin.binId,
          sourceBinNumber: sourceBinObj?.binNumber,
          targetBinId,
          targetBinNumber: targetBinObj?.binNumber,
          quantity: quantityToMove,
          reason: dto.reason || 'None',
          isUnquarantining,
        },
        actor: userId,
      });

      let newStatus = undefined;
      // Optional line update
      if (dto.lineId && dto.sourceType) {
        newStatus = isUnquarantining
          ? PUTAWAY_STATUS.PENDING_PUTAWAY
          : PUTAWAY_STATUS.QUARANTINED;
        if (dto.sourceType === 'goods_receipt') {
          await tx
            .update(goodsReceivedLines)
            .set({ putawayStatus: newStatus })
            .where(eq(goodsReceivedLines.goodsReceivedLineId, dto.lineId));
        } else if (dto.sourceType === 'sales_return') {
          await tx
            .update(salesOrderReturnLines)
            .set({ putawayStatus: newStatus })
            .where(eq(salesOrderReturnLines.returnLineId, dto.lineId));
        }
      }

      return { success: true, putawayStatus: newStatus };
    });
  }

  async moveStock(dto: import('./dto').MoveStockDto, userId: string) {
    return await this.db.transaction(async (tx) => {
      const movementLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];
      const reasonStr = dto.reason || 'Manual stock move';

      for (const line of dto.lines) {
        const [product] = await tx
          .select({ baseUom: products.baseUom })
          .from(products)
          .where(eq(products.productId, line.productId))
          .limit(1);

        // Fetch source and target bin details
        const [sourceBinInfo] = await tx
          .select({
            binId: bins.binId,
            binNumber: bins.binNumber,
            locationId: zones.locationId,
            zoneCode: zones.code,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, line.sourceBinId))
          .limit(1);

        const [targetBinInfo] = await tx
          .select({
            binId: bins.binId,
            locationId: zones.locationId,
            zoneCode: zones.code,
          })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(eq(bins.binId, line.targetBinId))
          .limit(1);

        if (!sourceBinInfo) {
          throw new BadRequestException(
            `Source bin ${line.sourceBinId} not found`,
          );
        }
        if (!targetBinInfo) {
          throw new BadRequestException(
            `Target bin ${line.targetBinId} not found`,
          );
        }
        if (sourceBinInfo.locationId !== targetBinInfo.locationId) {
          throw new BadRequestException(
            'Cannot move stock between different locations. Please use Transfer Orders instead.',
          );
        }
        if (targetBinInfo.zoneCode === 'HANDLING') {
          throw new BadRequestException(
            'Cannot manually move stock into system HANDLING bins.',
          );
        }
        if (
          sourceBinInfo.binNumber === 'RECEIVING' &&
          targetBinInfo.zoneCode !== 'HANDLING'
        ) {
          throw new BadRequestException(
            'Cannot manually move stock out of RECEIVING bins. Please use the Putaway process.',
          );
        }

        const requestedUom = line.uomCode || product?.baseUom || 'EA';
        const qtyToMove = parseFloat(line.quantity);
        if (qtyToMove <= 0) {
          throw new BadRequestException(
            'Quantity to move must be greater than zero',
          );
        }

        const absoluteQty = await this.uomService.calculateAbsoluteBaseQuantity(
          line.productId,
          [{ quantity: qtyToMove, uomCode: requestedUom }],
          tx,
        );

        // Verify available quantity in source bin (in base units)
        const [binContent] = await tx
          .select({ quantity: binContents.actualQuantity })
          .from(binContents)
          .where(
            and(
              eq(binContents.binId, line.sourceBinId),
              eq(binContents.productId, line.productId),
            ),
          )
          .limit(1);

        const availableQty = parseFloat(binContent?.quantity || '0');
        if (availableQty < absoluteQty) {
          throw new BadRequestException(
            `Insufficient stock in source bin. Available: ${availableQty}`,
          );
        }

        movementLines.push(
          {
            productId: line.productId,
            binId: line.sourceBinId,
            quantity: -qtyToMove,
            uomCode: requestedUom,
          },
          {
            productId: line.productId,
            binId: line.targetBinId,
            quantity: qtyToMove,
            uomCode: requestedUom,
          },
        );
      }

      if (movementLines.length > 0) {
        const entryNumber = `MOVE-${randomUUID().substring(0, 8).toUpperCase()}`;
        await this.recordInventoryMovement(tx, {
          entryNumber,
          sourceType: 'MANUAL',
          memo: dto.reason || 'N/A',
          userId,
          lines: movementLines,
        });

        // Emit general inventory moved event
        // Note: For advanced integration, we could emit individual events per line, but for this workflow one bulk event is often simpler.
        // @herobm-skip-audit - DB write is performed by recordInventoryMovement
        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.WAREHOUSE,
          entityId: dto.lines[0].sourceBinId, // Using first source bin as reference
          eventType: EventType.STOCK_MOVED,
          entityDisplayName: entryNumber,
          payload: {
            reason: reasonStr,
            lines: dto.lines,
          },
          actor: userId,
        });
      }

      return { success: true };
    });
  }

  private async changeReturnState(
    tx: DrizzleDB,
    returnId: string,
    stateCode: (typeof RETURN_STATE)[keyof typeof RETURN_STATE],
  ) {
    const [updated] = await tx
      .update(salesOrderReturns)
      .set({ stateCode })
      .where(eq(salesOrderReturns.returnId, returnId))
      .returning();

    if (updated) {
      await emitEvent(tx, {
        entityType: EntityType.SALES_RETURN,
        entityId: returnId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: updated.returnNumber,
        payload: {
          stateCode,
        },
        actor: 'system', // mostly system-driven
      });
    }
  }

  async adjustStock(dto: import('./dto').AdjustStockDto, userId: string) {
    if (!dto.lines || dto.lines.length === 0) return { success: true };

    return await this.db.transaction(async (tx) => {
      const movementLines: {
        productId: string;
        binId: string;
        quantity: number;
        uomCode: string;
      }[] = [];
      const reasonStr = dto.reason || 'N/A';

      for (const line of dto.lines) {
        const [product] = await tx
          .select({ baseUom: products.baseUom })
          .from(products)
          .where(eq(products.productId, line.productId))
          .limit(1);

        const currentContent = await tx
          .select({ actualQuantity: binContents.actualQuantity })
          .from(binContents)
          .where(
            and(
              eq(binContents.binId, line.binId),
              eq(binContents.productId, line.productId),
            ),
          )
          .limit(1);

        const currentQty =
          currentContent.length > 0
            ? Number(currentContent[0].actualQuantity)
            : 0;

        const requestedUom = line.uomCode || product?.baseUom || 'EA';
        const absoluteNewQty =
          await this.uomService.calculateAbsoluteBaseQuantity(
            line.productId,
            [{ quantity: Number(line.newQuantity), uomCode: requestedUom }],
            tx,
          );
        const diff = absoluteNewQty - currentQty;

        if (Math.abs(diff) > 0.001) {
          movementLines.push({
            productId: line.productId,
            binId: line.binId,
            quantity: diff,
            uomCode: product?.baseUom || 'EA',
          });
        }
      }

      if (movementLines.length > 0) {
        const entryNumber = `ADJ-${randomUUID().substring(0, 8).toUpperCase()}`;
        await this.recordInventoryMovement(tx, {
          entryNumber,
          sourceType: 'MANUAL_ADJUST',
          memo: reasonStr,
          userId,
          lines: movementLines,
        });
        // @herobm-skip-audit - DB write is performed by recordInventoryMovement
        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.WAREHOUSE,
          entityId: dto.lines[0].binId,
          eventType: EventType.STOCK_MOVED,
          entityDisplayName: entryNumber,
          payload: {
            reason: reasonStr,
            lines: movementLines,
          },
          actor: userId,
        });
      }

      return { success: true };
    });
  }
}
