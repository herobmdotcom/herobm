import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  goodsReceived,
  goodsReceivedLines,
  suppliers,
  supplierGroups,
  locations,
  products,
  purchaseOrders,
  purchaseOrderLineItems,
  zones,
  bins,
  binContents,
  backorders,
  glJournalEntries,
  glJournalLines,
} from '../drizzle/modbm-core-schema';

import { InventoryService } from '../inventory/inventory.service';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { PaginationQuery, parsePagination } from '../common/pagination';
import { evaluatePOLifecycleRules } from '../purchase-orders/purchase-order-lifecycle-rules';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { BackordersService } from '../orders/backorders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import {
  RECEIPT_STATE,
  RECEIPT_TRANSITIONS,
  PURCHASE_ORDER_STATE,
  PURCHASE_ORDER_TRANSITIONS,
  BACKORDER_STATE,
  BACKORDER_TRANSITIONS,
  getValidStates,
  PurchaseOrderState,
  BackorderState,
  PUTAWAY_STATUS,
  MATCH_STATUS,
} from '@modbm/shared';

const VALID_GRN_STATES = getValidStates(RECEIPT_TRANSITIONS);

@Injectable()
export class GoodsReceivedService {
  private readonly logger = new Logger(GoodsReceivedService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly backordersService: BackordersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
  ) {}

  /**
   * Create a goods receipt from a packing slip.
   *
   * Records what physically arrived on the dock.
   * - Writes inventory ledger/bin_contents (via InventoryService)
   * - Transitions PO states (if matched)
   *
   * Auto-matches each line to open PO lines for the same supplier + product.
   */
  async create(createDto: any, userId: string) {
    return await this.db.transaction(async (tx) => {
      // 1. Validate vendor and fetch group dimensions
      const [vendor] = await tx
        .select({
          vendorId: suppliers.vendorId,
          name: suppliers.name,
          costCenterId: supplierGroups.defaultCostCenterId,
          activityId: supplierGroups.defaultActivityId,
        })
        .from(suppliers)
        .leftJoin(
          supplierGroups,
          eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
        )
        .where(eq(suppliers.vendorId, createDto.vendorId))
        .limit(1);

      if (!vendor) {
        throw new NotFoundException('Supplier not found');
      }

      // 2. Validate location
      const [location] = await tx
        .select({ locationId: locations.locationId })
        .from(locations)
        .where(eq(locations.locationId, createDto.locationId))
        .limit(1);

      if (!location) {
        throw new NotFoundException('Location not found');
      }

      // 3. Create goods received header
      const receiptNumber = `GR-${randomUUID().substring(0, 8).toUpperCase()}`;

      const [receipt] = await tx
        .insert(goodsReceived)
        .values({
          receiptNumber,
          vendorId: createDto.vendorId,
          locationId: createDto.locationId,
          packingSlipNumber: createDto.packingSlipNumber,
          notes: createDto.notes,
          stateCode: RECEIPT_STATE.RECEIVED as any,
          createdBy: userId,
        })
        .returning();

      // 4. Process lines with auto-matching
      if (createDto.lines && createDto.lines.length > 0) {
        const lineValues = [];

        for (const line of createDto.lines) {
          // Validate product
          const [product] = await tx
            .select({ productId: products.productId })
            .from(products)
            .where(eq(products.productId, line.productId))
            .limit(1);

          if (!product) {
            throw new BadRequestException(
              `Product '${line.productId}' not found`,
            );
          }

          // Auto-match: find open PO lines for this vendor + product
          const openPoLines = await tx
            .select({
              purchaseOrderLineId: purchaseOrderLineItems.purchaseOrderLineId,
              purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
              quantity: purchaseOrderLineItems.quantity,
              quantityReceived: purchaseOrderLineItems.quantityReceived,
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
              and(
                eq(purchaseOrders.vendorId, createDto.vendorId),
                eq(purchaseOrderLineItems.productId, line.productId),
                eq(purchaseOrders.deliveryLocationId, createDto.locationId),
                sql`${purchaseOrders.stateCode} IN (${PURCHASE_ORDER_STATE.ORDERED}, ${PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED})`,
                sql`CAST(${purchaseOrderLineItems.quantityReceived} AS NUMERIC) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
                sql`CAST(${purchaseOrderLineItems.quantity} AS NUMERIC) - CAST(COALESCE(${purchaseOrderLineItems.quantityReceived}, '0') AS NUMERIC) >= CAST(${line.quantityReceived} AS NUMERIC)`,
              ),
            );

          let matchStatus: string;
          let matchedPoLineId: string | null = null;
          let matchedPoId: string | null = null;

          if (openPoLines.length === 1) {
            matchStatus = MATCH_STATUS.MATCHED;
            matchedPoLineId = openPoLines[0].purchaseOrderLineId;
            matchedPoId = openPoLines[0].purchaseOrderId;
          } else if (openPoLines.length > 1) {
            matchStatus = MATCH_STATUS.AMBIGUOUS;
          } else {
            matchStatus = MATCH_STATUS.UNMATCHED;
          }

          const unitCost = matchedPoLineId ? openPoLines[0].pricePerUnit : null;

          lineValues.push({
            goodsReceivedId: receipt.goodsReceivedId,
            productId: line.productId,
            quantityReceived: line.quantityReceived.toString(),
            matchStatus,
            putawayStatus:
              matchStatus === MATCH_STATUS.MATCHED
                ? PUTAWAY_STATUS.PENDING_PUTAWAY
                : PUTAWAY_STATUS.AWAITING_MATCHING,
            purchaseOrderLineId: matchedPoLineId,
            purchaseOrderId: matchedPoId,
            unitCost: unitCost, // Use for valuation, filtered out during insert
          } as any);
        }

        await tx
          .insert(goodsReceivedLines)
          .values(lineValues.map(({ unitCost, ...rest }: any) => rest));

        // --- 5. Inventory Impact: Place items into RECEIVING bin ---
        // Find or create RECEIVING zone/bin
        let receivingZone = await tx
          .select({ zoneId: zones.zoneId })
          .from(zones)
          .where(
            and(
              eq(zones.locationId, createDto.locationId),
              eq(zones.code, 'RECV'),
            ),
          )
          .limit(1)
          .then((res) => res[0]);

        if (!receivingZone) {
          const [newZone] = await tx
            .insert(zones)
            .values({
              locationId: createDto.locationId,
              code: 'RECV',
              name: 'Receiving Dock',
              createdBy: userId,
            })
            .returning();
          receivingZone = newZone;
        }

        let receivingBin = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .where(
            and(
              eq(bins.zoneId, receivingZone.zoneId),
              eq(bins.binNumber, 'RECEIVING'),
            ),
          )
          .limit(1)
          .then((res) => res[0]);

        if (!receivingBin) {
          const [newBin] = await tx
            .insert(bins)
            .values({
              zoneId: receivingZone.zoneId,
              binNumber: 'RECEIVING',
              binType: 'receiving',
              createdBy: userId,
            })
            .returning();
          receivingBin = newBin;
        }

        // Create inventory ledger entries via inventoryService
        await this.inventoryService.recordInventoryMovement(tx, {
          entryNumber: `GRN-${receipt.receiptNumber}`,
          sourceType: 'PO_RECEIPT',
          sourceId: receipt.goodsReceivedId,
          memo: `Goods Reception ${receipt.receiptNumber}`,
          userId,
          lines: lineValues.map((lv) => ({
            productId: lv.productId,
            binId: receivingBin.binId,
            quantity: parseFloat(lv.quantityReceived),
          })),
        });

        // --- 5.1 Financial Integration & Valuation Updates ---
        const valuationMethodCode = this.appConfig.valuationMethod();
        const valuationStrategy = getValuationStrategy(valuationMethodCode);

        // Fetch products to update their WAC and get standard costs
        const productIds = [...new Set(lineValues.map((l) => l.productId))];
        const productRows = await tx
          .select({
            productId: products.productId,
            standardCost: products.standardCost,
            weightedAverageCost: products.weightedAverageCost,
            qoh: sql`COALESCE((SELECT SUM(actual_quantity) FROM modbm_core.bin_contents WHERE product_id = ${products.productId}), 0)`.mapWith(
              Number,
            ),
          })
          .from(products)
          .where(
            sql`${products.productId} IN (${sql.join(
              productIds.map((p) => sql`${p}`),
              sql`, `,
            )})`,
          );

        const productMap = new Map(productRows.map((p) => [p.productId, p]));
        let totalInventoryValueAdded = 0;

        for (const lv of lineValues) {
          const product = productMap.get(lv.productId);
          if (!product) continue;

          const qty = parseFloat(lv.quantityReceived);
          const unitCost = lv.unitCost ? String(lv.unitCost) : '0';

          const productData = {
            ...product,
            standardCost: product.standardCost || '0',
            weightedAverageCost: product.weightedAverageCost || '0',
          };

          const valuation = valuationStrategy.onGoodsReceipt(
            productData,
            product.qoh,
            qty,
            unitCost,
          );

          totalInventoryValueAdded += parseFloat(valuation.inventoryValueAdded);

          // Update product WAC
          await tx
            .update(products)
            .set({ weightedAverageCost: valuation.newWeightedAverageCost })
            .where(eq(products.productId, product.productId));

          // Update local QOH to ensure subsequent lines calculate correctly
          product.qoh += qty;
          product.weightedAverageCost = valuation.newWeightedAverageCost;
        }

        // Post Journal Entry via Accounting Strategy
        const accountingStrategy = getAccountingStrategy(
          this.appConfig.inventoryAccountingMode(),
          {
            inventoryAccountId: this.appConfig.defaultInventoryAccountId(),
            grniAccountId: this.appConfig.defaultGrniAccountId(),
            cogsAccountId: this.appConfig.defaultCogsAccountId(),
            shrinkageAccountId: this.appConfig.defaultShrinkageAccountId(),
          },
        );

        const glResult = accountingStrategy.onGoodsReceipt({
          amount: Number(totalInventoryValueAdded.toFixed(2)),
          memo: `Goods Receipt ${receipt.receiptNumber}`,
          partyType: 'supplier',
          partyId: vendor.vendorId,
          costCenterId: vendor.costCenterId || undefined,
          activityId: vendor.activityId || undefined,
        });

        if (glResult) {
          await this.glService.postJournalEntry(
            glResult.lines as any,
            {
              actor: userId,
              entryDate: new Date().toISOString().slice(0, 10),
              sourceType: glResult.sourceType,
              sourceId: receipt.goodsReceivedId,
              memo: `Goods Receipt ${receipt.receiptNumber} (${vendor.name})`,
            },
            tx,
          );
        }

        // --- 6. PO Update: Update matched PO lines ---
        const matchedLines = lineValues.filter(
          (l) => l.matchStatus === MATCH_STATUS.MATCHED,
        );
        for (const ml of matchedLines) {
          await tx
            .update(purchaseOrderLineItems)
            .set({
              quantityReceived: sql`CAST(quantity_received AS NUMERIC) + CAST(${ml.quantityReceived} AS NUMERIC)`,
            })
            .where(
              eq(
                purchaseOrderLineItems.purchaseOrderLineId,
                ml.purchaseOrderLineId,
              ),
            );
        }

        // --- 6.1 Backorder Sync: Transition awaiting_receipt → received_reserved ---
        for (const ml of matchedLines) {
          if (!ml.purchaseOrderLineId) continue;

          const awaitingBackorders = await tx
            .select()
            .from(backorders)
            .where(
              and(
                eq(backorders.purchaseOrderLineId, ml.purchaseOrderLineId),
                eq(backorders.stateCode, BACKORDER_STATE.AWAITING_RECEIPT),
              ),
            );

          let receiptRemaining = parseFloat(ml.quantityReceived);

          for (const bo of awaitingBackorders) {
            if (receiptRemaining <= 0) break;
            const boQty = parseFloat(bo.quantity);

            if (receiptRemaining >= boQty) {
              // Fully fulfilled — transition entire backorder
              await this.backordersService.changeBackorderState(
                bo.backorderId,
                BACKORDER_STATE.RECEIVED_RESERVED,
                userId,
                tx,
              );
              receiptRemaining -= boQty;
            } else {
              // Partially fulfilled — split the backorder record
              await tx
                .update(backorders)
                .set({
                  quantity: (boQty - receiptRemaining).toString(),
                  modifiedOn: new Date(),
                })
                .where(eq(backorders.backorderId, bo.backorderId));

              await tx.insert(backorders).values({
                salesOrderId: bo.salesOrderId,
                salesOrderLineId: bo.salesOrderLineId,
                productId: bo.productId,
                purchaseOrderId: bo.purchaseOrderId,
                purchaseOrderLineId: bo.purchaseOrderLineId,
                quantity: receiptRemaining.toString(),
                stateCode: BACKORDER_STATE.RECEIVED_RESERVED,
              });
              receiptRemaining = 0;
            }
          }
        }

        // Recompute PO State for any affected POs
        const updatedPoIds = [
          ...new Set(
            matchedLines.map((l) => l.purchaseOrderId!).filter(Boolean),
          ),
        ];
        for (const poId of updatedPoIds) {
          // Trigger the lifecycle engine instead of hardcoded updates
          try {
            await evaluatePOLifecycleRules(
              tx as any,
              poId,
              {
                entity: 'goods_receipt',
                action: 'created',
              },
              'system',
            );
          } catch (err) {
            this.logger.error(
              `Failed to evaluate PO lifecycle rules for PO ${poId} after goods receipt:`,
              err,
            );
          }
        }
      }

      // 7. Emit audit event
      await emitEvent(tx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: receipt.goodsReceivedId,
        eventType: EventType.STOCK_RECEIVED,
        payload: {
          goodsReceivedId: receipt.goodsReceivedId,
          receiptNumber: receipt.receiptNumber,
          vendorId: createDto.vendorId,
          vendorName: vendor.name,
          locationId: createDto.locationId,
          packingSlipNumber: createDto.packingSlipNumber,
          lineCount: createDto.lines?.length || 0,
        },
        actor: userId,
      });

      this.logger.log(
        `Goods received ${receiptNumber} created for supplier ${vendor.name}`,
      );

      return this.findOne(receipt.goodsReceivedId, tx);
    });
  }

  /**
   * Cancel a goods receipt.
   *
   * Reverses inventory ledgers, GL integration, decrements PO quantity,
   * and reverts PO state if applicable.
   */
  async cancelReception(goodsReceivedId: string, userId: string) {
    return await this.db.transaction(async (tx) => {
      // 1. Load receipt and lines
      const [receipt] = await tx
        .select()
        .from(goodsReceived)
        .where(eq(goodsReceived.goodsReceivedId, goodsReceivedId))
        .limit(1);

      if (!receipt) {
        throw new NotFoundException(
          `Goods receipt ${goodsReceivedId} not found.`,
        );
      }

      if (receipt.stateCode === RECEIPT_STATE.CANCELLED) {
        throw new BadRequestException('Receipt is already cancelled.');
      }

      const receiptLines = await tx
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedId, goodsReceivedId));

      // 2. Validate states
      for (const line of receiptLines) {
        if (line.putawayStatus === PUTAWAY_STATUS.COMPLETED) {
          throw new BadRequestException(
            `Line ${line.goodsReceivedLineId} has been putaway. Cannot cancel receipt directly. You must reverse the putaway first.`,
          );
        }
      }

      // Check if it is invoiced (Optional, but if we don't have purchase_invoice_lines handy, stateCode 'invoiced' on GR isn't tracked. We will rely on manual checks if any).
      // Wait, let's assume no invoice logic is explicitly checked for now, just cancellation.

      // 3. Reverse Inventory Movement
      const receivingBinCode = 'RECEIVING';
      const [receivingZone] = await tx
        .select({ zoneId: zones.zoneId })
        .from(zones)
        .where(
          and(eq(zones.locationId, receipt.locationId), eq(zones.code, 'RECV')),
        )
        .limit(1);

      if (!receivingZone) {
        throw new BadRequestException(
          'Receiving zone not found. Cannot cancel.',
        );
      }

      const [receivingBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .where(
          and(
            eq(bins.zoneId, receivingZone.zoneId),
            eq(bins.binNumber, receivingBinCode),
          ),
        )
        .limit(1);

      if (!receivingBin) {
        throw new BadRequestException(
          'Receiving bin not found. Cannot cancel.',
        );
      }

      await this.inventoryService.recordInventoryMovement(tx, {
        entryNumber: `CAN-${receipt.receiptNumber}`,
        sourceType: 'PO_RECEIPT',
        sourceId: receipt.goodsReceivedId,
        memo: `Cancel Reception ${receipt.receiptNumber}`,
        userId,
        lines: receiptLines.map((lv) => ({
          productId: lv.productId,
          binId: receivingBin.binId,
          quantity: -parseFloat(lv.quantityReceived),
        })),
      });

      // 4. Reverse Financial Integration (GL)
      // Find the original journal entry
      const [originalEntry] = await tx
        .select()
        .from(glJournalEntries)
        .where(
          and(
            eq(glJournalEntries.sourceId, receipt.goodsReceivedId),
            eq(glJournalEntries.sourceType, 'inventory_receipt'),
          ),
        )
        .limit(1);

      if (originalEntry) {
        const originalLines = await tx
          .select()
          .from(glJournalLines)
          .where(
            eq(glJournalLines.journalEntryId, originalEntry.journalEntryId),
          );

        if (originalLines.length > 0) {
          const reversedLines = originalLines.map((line) => ({
            accountId: line.glAccountId,
            costCenterId: line.costCenterId,
            activityId: line.activityId,
            partyType: line.partyType,
            partyId: line.partyId,
            debit: parseFloat(line.credit), // Swap debits/credits
            credit: parseFloat(line.debit),
            memo: `Reversal of ${originalEntry.entryNumber}`,
          }));

          await this.glService.postJournalEntry(
            reversedLines as any,
            {
              actor: userId,
              entryDate: new Date().toISOString().slice(0, 10),
              sourceType: 'inventory_receipt',
              sourceId: receipt.goodsReceivedId,
              memo: `Cancel Reception ${receipt.receiptNumber}`,
            },
            tx,
          );
        }
      }

      // 5. Decrement PO lines and revert PO state
      const updatedPoIds = new Set<string>();

      for (const line of receiptLines) {
        if (
          line.matchStatus === MATCH_STATUS.MATCHED &&
          line.purchaseOrderLineId &&
          line.purchaseOrderId
        ) {
          await tx.execute(
            sql`UPDATE modbm_core.purchase_order_lines 
                SET quantity_received = COALESCE(quantity_received, 0) - CAST(${line.quantityReceived} AS NUMERIC)
                WHERE purchase_order_line_id = ${line.purchaseOrderLineId}`,
          );
          updatedPoIds.add(line.purchaseOrderId);
        }
      }

      // Revert PO States
      for (const poId of updatedPoIds) {
        const lines = await tx
          .select({
            quantityReceived: purchaseOrderLineItems.quantityReceived,
          })
          .from(purchaseOrderLineItems)
          .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

        const totalReceived = lines.reduce(
          (sum, l) => sum + parseFloat(l.quantityReceived || '0'),
          0,
        );

        let newPoState: PurchaseOrderState = PURCHASE_ORDER_STATE.ORDERED;
        if (totalReceived > 0) {
          // If there are still received lines, it might be partially received
          newPoState = PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED;
        }

        // Just blindly revert state, assuming no invoice blocking. If the user wants to close short later they can.
        await this.purchaseOrdersService.changePurchaseOrderState(
          poId,
          newPoState,
          userId,
          tx,
        );

        await emitEvent(tx, {
          aggregateType: AggregateType.PURCHASE_ORDER,
          aggregateId: poId,
          eventType: EventType.AUTO_STATUS_CHANGED,
          payload: {
            rule: 'cancel_receipt_revert',
            from: PURCHASE_ORDER_STATE.RECEIVED,
            to: newPoState,
            reason: `Receipt ${receipt.receiptNumber} was cancelled.`,
          },
          actor: userId,
        });
      }

      // 6. Update GR state
      await this.changeReceiptState(
        goodsReceivedId,
        RECEIPT_STATE.CANCELLED,
        userId,
        tx,
      );

      this.logger.log(
        `Goods received ${receipt.receiptNumber} cancelled by ${userId}`,
      );

      return { success: true };
    });
  }

  /**
   * Universal changeState for Goods Receipt
   */
  async changeReceiptState(
    receiptId: string,
    newState: string,
    actor: string,
    tx: DrizzleDB,
  ) {
    if (!VALID_GRN_STATES.includes(newState)) {
      throw new BadRequestException(
        `Invalid goods receipt state: '${newState}'`,
      );
    }

    const [receipt] = await tx
      .select({
        stateCode: goodsReceived.stateCode,
        receiptNumber: goodsReceived.receiptNumber,
      })
      .from(goodsReceived)
      .where(eq(goodsReceived.goodsReceivedId, receiptId));

    if (!receipt) {
      throw new NotFoundException(`Receipt ${receiptId} not found`);
    }

    const allowed = RECEIPT_TRANSITIONS[receipt.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition receipt from '${receipt.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await tx
      .update(goodsReceived)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(goodsReceived.goodsReceivedId, receiptId))
      .returning();

    await emitEvent(tx as any, {
      aggregateType: AggregateType.GOODS_RECEIPT,
      aggregateId: receiptId,
      eventType: EventType.STATUS_CHANGED,
      payload: {
        entity: 'goods_receipt',
        entityId: receiptId,
        receiptNumber: receipt.receiptNumber,
        from: receipt.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }

  /**
   * List all goods receipts with pagination and optional filtering.
   */
  async findAll(params: PaginationQuery) {
    const { page, limit, offset, searchTerm, days } = parsePagination(params);

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(goodsReceived.receiptNumber, searchTerm),
          ilike(goodsReceived.packingSlipNumber, searchTerm),
          ilike(suppliers.name, searchTerm),
        ),
      );
    }

    if (days && days > 0) {
      conditions.push(
        sql`${goodsReceived.createdOn} >= now() - interval '${sql.raw(String(days))} days'`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await this.db
      .select({
        receipt: goodsReceived,
        vendorName: suppliers.name,
        vendorNumber: suppliers.vendorNumber,
      })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(goodsReceived.createdOn));

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .where(whereClause);

    // For each receipt, count match statuses
    const receiptIds = data.map((d) => d.receipt.goodsReceivedId);
    let matchCounts: Map<string, { total: number; matched: number }> =
      new Map();

    if (receiptIds.length > 0) {
      const lineCounts = await this.db
        .select({
          goodsReceivedId: goodsReceivedLines.goodsReceivedId,
          total: sql<number>`count(*)`,
          matched: sql<number>`count(*) FILTER (WHERE ${goodsReceivedLines.matchStatus} = 'matched')`,
        })
        .from(goodsReceivedLines)
        .where(
          sql`${goodsReceivedLines.goodsReceivedId} IN (${sql.join(
            receiptIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        )
        .groupBy(goodsReceivedLines.goodsReceivedId);

      matchCounts = new Map(
        lineCounts.map((lc) => [
          lc.goodsReceivedId,
          { total: Number(lc.total), matched: Number(lc.matched) },
        ]),
      );
    }

    return {
      data: data.map((d) => {
        const counts = matchCounts.get(d.receipt.goodsReceivedId) || {
          total: 0,
          matched: 0,
        };
        return {
          ...d.receipt,
          vendorName: d.vendorName,
          vendorNumber: d.vendorNumber,
          totalLines: counts.total,
          matchedLines: counts.matched,
        };
      }),
      page,
      limit,
      total: Number(count),
    };
  }

  /**
   * List all goods receipt lines with pagination and optional filtering.
   * This provides a flattened "Receipt Lines" view.
   */
  async findAllLines(
    params: PaginationQuery,
    purchaseOrderId?: string,
    putawayStatus?: string,
    locationId?: string,
  ) {
    const { page, limit, offset, searchTerm, days } = parsePagination(params);

    const conditions = [];

    if (purchaseOrderId) {
      conditions.push(eq(goodsReceivedLines.purchaseOrderId, purchaseOrderId));
    }

    if (putawayStatus) {
      conditions.push(
        eq(goodsReceivedLines.putawayStatus, putawayStatus as any),
      );
    }

    if (locationId) {
      conditions.push(eq(goodsReceived.locationId, locationId));
    }

    if (searchTerm) {
      conditions.push(
        or(
          ilike(goodsReceived.receiptNumber, searchTerm),
          ilike(goodsReceived.packingSlipNumber, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(products.alternateProductNumber, searchTerm),
          ilike(products.name, searchTerm),
          ilike(suppliers.name, searchTerm),
        ),
      );
    }

    if (days && days > 0) {
      conditions.push(
        sql`${goodsReceived.createdOn} >= now() - interval '${sql.raw(String(days))} days'`,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const data = await this.db
      .select({
        line: goodsReceivedLines,
        receiptNumber: goodsReceived.receiptNumber,
        packingSlipNumber: goodsReceived.packingSlipNumber,
        vendorId: suppliers.vendorId,
        vendorName: suppliers.name,
        createdOn: goodsReceived.createdOn,
        locationId: goodsReceived.locationId,
        locationName: locations.name,
        productNumber: products.productNumber,
        productName: products.name,
        orderNumber: purchaseOrders.orderNumber,
        stateCode: goodsReceived.stateCode,
      })
      .from(goodsReceivedLines)
      .leftJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .leftJoin(locations, eq(goodsReceived.locationId, locations.locationId))
      .where(whereClause)
      .limit(limit)
      .offset(offset)
      .orderBy(desc(goodsReceived.createdOn));

    const [{ count }] = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(goodsReceivedLines)
      .leftJoin(
        goodsReceived,
        eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
      )
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .where(whereClause);

    return {
      data: data.map((d) => ({
        ...d.line,
        receiptNumber: d.receiptNumber,
        packingSlipNumber: d.packingSlipNumber,
        vendorId: d.vendorId,
        vendorName: d.vendorName,
        createdOn: d.createdOn,
        locationId: d.locationId,
        locationName: d.locationName,
        productNumber: d.productNumber,
        productName: d.productName,
        orderNumber: d.orderNumber,
        stateCode: d.stateCode,
      })),
      page,
      limit,
      total: Number(count),
    };
  }

  /**
   * Get a single goods receipt with all lines.
   */
  async findOne(id: string, tx: any = this.db) {
    const receipt = await tx
      .select({
        receipt: goodsReceived,
        vendorName: suppliers.name,
        vendorNumber: suppliers.vendorNumber,
      })
      .from(goodsReceived)
      .leftJoin(suppliers, eq(goodsReceived.vendorId, suppliers.vendorId))
      .where(eq(goodsReceived.goodsReceivedId, id))
      .limit(1)
      .then((res: any[]) => res[0]);

    if (!receipt) {
      throw new NotFoundException(`Goods receipt ${id} not found`);
    }

    const lines = await tx
      .select({
        goodsReceivedLineId: goodsReceivedLines.goodsReceivedLineId,
        productId: goodsReceivedLines.productId,
        quantityReceived: goodsReceivedLines.quantityReceived,
        matchStatus: goodsReceivedLines.matchStatus,
        putawayStatus: goodsReceivedLines.putawayStatus,
        purchaseOrderLineId: goodsReceivedLines.purchaseOrderLineId,
        purchaseOrderId: goodsReceivedLines.purchaseOrderId,
        productNumber: products.productNumber,
        productName: products.name,
        orderNumber: purchaseOrders.orderNumber,
      })
      .from(goodsReceivedLines)
      .leftJoin(products, eq(goodsReceivedLines.productId, products.productId))
      .leftJoin(
        purchaseOrders,
        eq(goodsReceivedLines.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(eq(goodsReceivedLines.goodsReceivedId, id));

    return {
      ...receipt.receipt,
      vendorName: receipt.vendorName,
      vendorNumber: receipt.vendorNumber,
      lines,
    };
  }

  /**
   * Manually resolve an ambiguous or unmatched line to a specific PO line.
   */
  async resolveAllocation(
    goodsReceivedLineId: string,
    poLineId: string,
    userId: string,
    allocatedQuantity?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const [grLine] = await tx
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId))
        .limit(1);

      if (!grLine) throw new NotFoundException('Line not found');
      if (grLine.matchStatus === MATCH_STATUS.MATCHED)
        throw new BadRequestException('Line already matched');

      const [poLine] = await tx
        .select({
          poLineId: purchaseOrderLineItems.purchaseOrderLineId,
          poId: purchaseOrderLineItems.purchaseOrderId,
          quantity: purchaseOrderLineItems.quantity,
          quantityReceived: purchaseOrderLineItems.quantityReceived,
          stateCode: purchaseOrders.stateCode,
        })
        .from(purchaseOrderLineItems)
        .innerJoin(
          purchaseOrders,
          eq(
            purchaseOrderLineItems.purchaseOrderId,
            purchaseOrders.purchaseOrderId,
          ),
        )
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, poLineId))
        .limit(1);

      if (!poLine) throw new NotFoundException('PO Line not found');
      if (
        [
          PURCHASE_ORDER_STATE.RECEIVED,
          PURCHASE_ORDER_STATE.INVOICED,
          PURCHASE_ORDER_STATE.CANCELLED,
          PURCHASE_ORDER_STATE.CLOSED_SHORT,
        ].includes(poLine.stateCode as any)
      ) {
        throw new BadRequestException(
          `Cannot match to a PO in '${poLine.stateCode}' state.`,
        );
      }

      const originalQuantity = parseFloat(grLine.quantityReceived);
      const targetQuantity = allocatedQuantity
        ? parseFloat(allocatedQuantity)
        : originalQuantity;

      if (targetQuantity <= 0 || targetQuantity > originalQuantity) {
        throw new BadRequestException('Invalid allocated quantity');
      }

      // Update GR Line
      await tx
        .update(goodsReceivedLines)
        .set({
          matchStatus: MATCH_STATUS.MATCHED,
          // ADV-086: Preserve quarantined status if set — matching doesn't clear quarantine
          putawayStatus:
            grLine.putawayStatus === PUTAWAY_STATUS.QUARANTINED
              ? PUTAWAY_STATUS.QUARANTINED
              : PUTAWAY_STATUS.PENDING_PUTAWAY,
          purchaseOrderLineId: poLine.poLineId,
          purchaseOrderId: poLine.poId,
          quantityReceived: targetQuantity.toString(),
        })
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId));

      // Handle partial allocation splits
      let splitLine = null;
      if (targetQuantity < originalQuantity) {
        const remainder = originalQuantity - targetQuantity;
        const [inserted] = await tx
          .insert(goodsReceivedLines)
          .values({
            goodsReceivedId: grLine.goodsReceivedId,
            productId: grLine.productId,
            quantityReceived: remainder.toString(),
            matchStatus: MATCH_STATUS.AMBIGUOUS,
            putawayStatus: PUTAWAY_STATUS.AWAITING_MATCHING,
          })
          .returning();
        splitLine = inserted;
      }

      // Update PO Line
      await tx
        .update(purchaseOrderLineItems)
        .set({
          quantityReceived: sql`CAST(quantity_received AS NUMERIC) + CAST(${targetQuantity} AS NUMERIC)`,
        })
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, poLine.poLineId));

      // --- Backorder Sync: Transition awaiting_receipt → received_reserved ---
      const awaitingBackorders = await tx
        .select()
        .from(backorders)
        .where(
          and(
            eq(backorders.purchaseOrderLineId, poLine.poLineId),
            eq(backorders.stateCode, BACKORDER_STATE.AWAITING_RECEIPT),
          ),
        );

      let receiptRemaining = targetQuantity;

      for (const bo of awaitingBackorders) {
        if (receiptRemaining <= 0) break;
        const boQty = parseFloat(bo.quantity);

        if (receiptRemaining >= boQty) {
          await this.backordersService.changeBackorderState(
            bo.backorderId,
            BACKORDER_STATE.RECEIVED_RESERVED,
            userId,
            tx,
          );
          receiptRemaining -= boQty;
        } else {
          await tx
            .update(backorders)
            .set({
              quantity: (boQty - receiptRemaining).toString(),
              modifiedOn: new Date(),
            })
            .where(eq(backorders.backorderId, bo.backorderId));

          await tx.insert(backorders).values({
            salesOrderId: bo.salesOrderId,
            salesOrderLineId: bo.salesOrderLineId,
            productId: bo.productId,
            purchaseOrderId: bo.purchaseOrderId,
            purchaseOrderLineId: bo.purchaseOrderLineId,
            quantity: receiptRemaining.toString(),
            stateCode: BACKORDER_STATE.RECEIVED_RESERVED,
          });
          receiptRemaining = 0;
        }
      }

      // Recompute PO State
      const poLines = await tx
        .select({
          quantity: purchaseOrderLineItems.quantity,
          quantityReceived: purchaseOrderLineItems.quantityReceived,
        })
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderId, poLine.poId));

      const allFullyReceived = poLines.every(
        (l) =>
          parseFloat(l.quantityReceived || '0') >=
          parseFloat(l.quantity || '0'),
      );

      const newState = allFullyReceived
        ? PURCHASE_ORDER_STATE.RECEIVED
        : PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED;

      await this.purchaseOrdersService.changePurchaseOrderState(
        poLine.poId,
        newState as any,
        userId,
        tx,
      );

      // Emit Event
      await emitEvent(tx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: grLine.goodsReceivedId,
        eventType: EventType.RECEIPT_MATCHED,
        payload: {
          goodsReceivedLineId,
          purchaseOrderLineId: poLine.poLineId,
          purchaseOrderId: poLine.poId,
          allocatedQuantity: targetQuantity,
        },
        actor: userId,
      });

      return { success: true, splitLine };
    });
  }

  /**
   * Unresolve a previously matched line back to ambiguous state.
   */
  async unresolveAllocation(goodsReceivedLineId: string, userId: string) {
    return await this.db.transaction(async (tx) => {
      const [grLine] = await tx
        .select()
        .from(goodsReceivedLines)
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId))
        .limit(1);

      if (!grLine) throw new NotFoundException('Line not found');
      if (
        grLine.matchStatus !== MATCH_STATUS.MATCHED ||
        !grLine.purchaseOrderLineId
      ) {
        throw new BadRequestException('Line is not matched to a PO');
      }

      const [poLine] = await tx
        .select({
          poLineId: purchaseOrderLineItems.purchaseOrderLineId,
          poId: purchaseOrderLineItems.purchaseOrderId,
          quantity: purchaseOrderLineItems.quantity,
          quantityReceived: purchaseOrderLineItems.quantityReceived,
        })
        .from(purchaseOrderLineItems)
        .where(
          eq(
            purchaseOrderLineItems.purchaseOrderLineId,
            grLine.purchaseOrderLineId,
          ),
        )
        .limit(1);

      if (!poLine) throw new NotFoundException('Linked PO Line not found');

      // 1. Attempt Reunification or fall back to making it ambiguous
      const [existingUnmatched] = await tx
        .select()
        .from(goodsReceivedLines)
        .where(
          and(
            eq(goodsReceivedLines.goodsReceivedId, grLine.goodsReceivedId),
            eq(goodsReceivedLines.productId, grLine.productId),
            sql`${goodsReceivedLines.matchStatus} != ${MATCH_STATUS.MATCHED}`,
            sql`${goodsReceivedLines.goodsReceivedLineId} != ${grLine.goodsReceivedLineId}`,
          ),
        )
        .limit(1);

      if (existingUnmatched) {
        // Reunify into the existing unmatched line
        await tx
          .update(goodsReceivedLines)
          .set({
            quantityReceived: sql`CAST(quantity_received AS NUMERIC) + CAST(${grLine.quantityReceived} AS NUMERIC)`,
          })
          .where(
            eq(
              goodsReceivedLines.goodsReceivedLineId,
              existingUnmatched.goodsReceivedLineId,
            ),
          );

        // Delete this fragmented line
        await tx
          .delete(goodsReceivedLines)
          .where(
            eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId),
          );
      } else {
        // Just unresolve it normally
        // ADV-086: Preserve quarantined status — only clear PO links, don't change putaway state
        await tx
          .update(goodsReceivedLines)
          .set({
            matchStatus: MATCH_STATUS.AMBIGUOUS,
            putawayStatus:
              grLine.putawayStatus === PUTAWAY_STATUS.QUARANTINED
                ? PUTAWAY_STATUS.QUARANTINED
                : PUTAWAY_STATUS.AWAITING_MATCHING,
            purchaseOrderLineId: null,
            purchaseOrderId: null,
          })
          .where(
            eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId),
          );
      }

      // 2. Deduct quantity from PO Line
      await tx
        .update(purchaseOrderLineItems)
        .set({
          quantityReceived: sql`CAST(quantity_received AS NUMERIC) - CAST(${grLine.quantityReceived} AS NUMERIC)`,
        })
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, poLine.poLineId));

      // 3. Recompute PO State
      const poLines = await tx
        .select({
          quantity: purchaseOrderLineItems.quantity,
          quantityReceived: purchaseOrderLineItems.quantityReceived,
        })
        .from(purchaseOrderLineItems)
        .where(eq(purchaseOrderLineItems.purchaseOrderId, poLine.poId));

      const allFullyReceived = poLines.every(
        (l) =>
          parseFloat(l.quantityReceived || '0') >=
          parseFloat(l.quantity || '0'),
      );

      const anyReceived = poLines.some(
        (l) => parseFloat(l.quantityReceived || '0') > 0,
      );

      const newState = allFullyReceived
        ? PURCHASE_ORDER_STATE.RECEIVED
        : anyReceived
          ? PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED
          : PURCHASE_ORDER_STATE.ORDERED;

      await this.purchaseOrdersService.changePurchaseOrderState(
        poLine.poId,
        newState as any,
        userId,
        tx,
      );

      // 4. Emit Event
      await emitEvent(tx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: grLine.goodsReceivedId,
        eventType: EventType.RECEIPT_UNMATCHED,
        payload: {
          goodsReceivedLineId,
          previousPurchaseOrderLineId: poLine.poLineId,
          previousPurchaseOrderId: poLine.poId,
        },
        actor: userId,
      });

      return { success: true };
    });
  }
}
