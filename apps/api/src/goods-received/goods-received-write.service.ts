// security-ignore: sql-raw
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  ConflictException,
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
  actors,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  eq,
  and,
  sql,
  desc,
  or,
  ilike,
  asc,
  getTableColumns,
} from 'drizzle-orm';
import { randomUUID } from 'crypto';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { evaluatePOLifecycleRules } from '../purchase-orders/purchase-order-lifecycle-rules';
import { AppConfigService } from '../settings/app-config.service';
import { GlService } from '../gl/gl.service';
import { getValuationStrategy } from '../inventory/valuation';
import { getAccountingStrategy } from '../inventory/inventory-accounting';
import { BackordersService } from '../orders/backorders.service';
import { PurchaseOrdersService } from '../purchase-orders/purchase-orders.service';
import {
  GOODS_RECEIVED_STATE,
  GoodsReceivedState,
  GOODS_RECEIVED_TRANSITIONS,
  PURCHASE_ORDER_STATE,
  PURCHASE_ORDER_TRANSITIONS,
  BACKORDER_STATE,
  BACKORDER_TRANSITIONS,
  getValidStates,
  PurchaseOrderState,
  BackorderState,
  PUTAWAY_STATUS,
  MATCH_STATUS,
} from '@herobm/shared';
import { InventoryMovementService } from '../inventory/inventory-movement.service';

const VALID_GRN_STATES = getValidStates(GOODS_RECEIVED_TRANSITIONS);

import { GoodsReceivedCoreService } from './goods-received-core.service';
import { GoodsReceivedStateService } from './goods-received-state.service';
import { CreateGoodsReceivedDto, UpdateGoodsReceivedDto } from './dto';

@Injectable()
export class GoodsReceivedWriteService {
  private readonly logger = new Logger(GoodsReceivedWriteService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly backordersService: BackordersService,
    private readonly purchaseOrdersService: PurchaseOrdersService,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly coreService: GoodsReceivedCoreService,
    private readonly stateService: GoodsReceivedStateService,
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
  async create(
    createDto: import('./dto').CreateGoodsReceivedDto,
    userId: string,
  ) {
    return await this.db.transaction(async (tx) => {
      // 1. Validate vendor and fetch group dimensions
      const [vendor] = await tx
        .select({
          vendorId: suppliers.vendorId,
          name: actors.name,
          costCenterId: supplierGroups.defaultCostCenterId,
          activityId: supplierGroups.defaultActivityId,
        })
        .from(suppliers)
        .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
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
        .select({ locationId: locations.locationId, name: locations.name })
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
          goodsReceivedId: createDto.goodsReceivedId,
          receiptNumber,
          vendorId: createDto.vendorId,
          locationId: createDto.locationId,
          packingSlipNumber: createDto.packingSlipNumber,
          notes: createDto.notes,
          stateCode: GOODS_RECEIVED_STATE.RECEIVED,
          createdBy: userId,
        })
        .returning();

      // 4. Process lines with auto-matching
      if (createDto.lines && createDto.lines.length > 0) {
        const lineValues: (typeof goodsReceivedLines.$inferInsert & {
          unitCost: string | null;
          uomCode: string;
        })[] = [];

        for (const line of createDto.lines) {
          // Validate product
          const [product] = await tx
            .select({
              productId: products.productId,
              baseUom: products.baseUom,
            })
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
              unitOfMeasure: purchaseOrderLineItems.unitOfMeasure,
              exchangeRate: purchaseOrders.exchangeRate,
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
                createDto.purchaseOrderId
                  ? eq(
                      purchaseOrders.purchaseOrderId,
                      createDto.purchaseOrderId,
                    )
                  : undefined,
                line.purchaseOrderLineId
                  ? eq(
                      purchaseOrderLineItems.purchaseOrderLineId,
                      line.purchaseOrderLineId,
                    )
                  : undefined,
                sql`${purchaseOrders.stateCode} IN (${PURCHASE_ORDER_STATE.ORDERED}, ${PURCHASE_ORDER_STATE.PARTIALLY_RECEIVED})`,
                sql`CAST(COALESCE(${purchaseOrderLineItems.quantityReceived}, '0') AS NUMERIC) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
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

          const unitCost = matchedPoLineId
            ? String(
                parseFloat(openPoLines[0].pricePerUnit) *
                  parseFloat(openPoLines[0].exchangeRate || '1'),
              )
            : null;

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
            uomCode:
              openPoLines.length > 0
                ? openPoLines[0].unitOfMeasure || product.baseUom
                : product.baseUom,
          });
        }

        await tx
          .insert(goodsReceivedLines)
          .values(lineValues.map(({ uomCode, ...rest }) => rest));

        // --- 5. Inventory Impact: Place items into RECEIVING bin ---
        // Find RECEIVING zone/bin
        const receivingZone = await tx
          .select({ zoneId: zones.zoneId })
          .from(zones)
          .where(
            and(
              eq(zones.locationId, createDto.locationId),
              eq(zones.code, 'HANDLING'),
            ),
          )
          .limit(1)
          .then((res) => res[0]);

        if (!receivingZone) {
          throw new ConflictException(
            `Location topography is corrupted: missing HANDLING zone for location ${createDto.locationId}.`,
          );
        }

        const receivingBin = await tx
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
          throw new ConflictException(
            `Location topography is corrupted: missing RECEIVING bin for location ${createDto.locationId}.`,
          );
        }

        // --- 5.1 Financial Integration & Valuation Updates ---
        const valuationMethodCode = this.appConfig.valuationMethod();
        const valuationStrategy = getValuationStrategy(valuationMethodCode);

        // Fetch products to update their WAC and get standard costs
        // MUST BE DONE BEFORE recordInventoryMovement so QOH doesn't include the newly received goods!
        const productIds = [...new Set(lineValues.map((l) => l.productId))];
        const productRows = await tx
          .select({
            productId: products.productId,
            standardCost: products.standardCost,
            weightedAverageCost: products.weightedAverageCost,
            qoh: sql`COALESCE((SELECT SUM(actual_quantity) FROM herobm_core.bin_contents WHERE product_id = products.product_id), 0)`.mapWith(
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

        // Create inventory ledger entries via inventoryService
        await this.inventoryMovementService.recordInventoryMovement(tx, {
          entryNumber: `GRN-${receipt.receiptNumber}`,
          sourceType: 'PO_RECEIPT',
          sourceId: receipt.goodsReceivedId,
          memo: `Goods Reception ${receipt.receiptNumber}`,
          userId,
          lines: lineValues.map((lv) => ({
            productId: lv.productId,
            binId: receivingBin.binId,
            quantity: parseFloat(lv.quantityReceived),
            uomCode: lv.uomCode,
          })),
        });

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
            ppvAccountId: this.appConfig.defaultPpvAccountId(),
          },
        );

        const glResult = accountingStrategy.onGoodsReceipt({
          amount: Number(totalInventoryValueAdded.toFixed(2)),
          memo: `Goods Receipt ${receipt.receiptNumber}`,
          partyType: 'supplier',
          partyId: vendor.vendorId,
          costCenterId:
            vendor.costCenterId ||
            this.appConfig.defaultCostCenterId() ||
            undefined,
          activityId:
            vendor.activityId ||
            this.appConfig.defaultActivityId() ||
            undefined,
        });

        if (glResult) {
          await this.glService.postJournalEntry(
            glResult.lines as Parameters<GlService['postJournalEntry']>[0],
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
          if (!ml.purchaseOrderLineId) continue;

          await tx
            .update(purchaseOrderLineItems)
            .set({
              quantityReceived: sql`CAST(COALESCE(quantity_received, '0') AS NUMERIC) + CAST(${ml.quantityReceived} AS NUMERIC)`,
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
              tx as unknown as DrizzleDB,
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
        entityType: EntityType.WAREHOUSE,
        entityId: receipt.goodsReceivedId,
        eventType: EventType.RECEIPT_CREATED,
        entityDisplayName: receipt.receiptNumber,
        payload: {
          goodsReceivedId: receipt.goodsReceivedId,
          receiptNumber: receipt.receiptNumber,
          vendorId: createDto.vendorId,
          vendorName: vendor.name,
          locationId: createDto.locationId,
          locationName: location.name,
          packingSlipNumber: createDto.packingSlipNumber,
          lineCount: createDto.lines?.length || 0,
        },
        actor: userId,
      });

      this.logger.log(
        `Goods received ${receiptNumber} created for supplier ${vendor.name}`,
      );

      return this.coreService.findOne(receipt.goodsReceivedId, tx);
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

      if (receipt.stateCode === GOODS_RECEIVED_STATE.CANCELLED) {
        throw new BadRequestException('Receipt is already cancelled.');
      }

      const receiptLines = await tx
        .select({
          goodsReceivedLineId: goodsReceivedLines.goodsReceivedLineId,
          goodsReceivedId: goodsReceivedLines.goodsReceivedId,
          productId: goodsReceivedLines.productId,
          purchaseOrderLineId: goodsReceivedLines.purchaseOrderLineId,
          purchaseOrderId: goodsReceivedLines.purchaseOrderId,
          quantityReceived: goodsReceivedLines.quantityReceived,
          matchStatus: goodsReceivedLines.matchStatus,
          putawayStatus: goodsReceivedLines.putawayStatus,
          unitCost: goodsReceivedLines.unitCost,
          uomCode: purchaseOrderLineItems.unitOfMeasure,
          baseUom: products.baseUom,
        })
        .from(goodsReceivedLines)
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
          and(
            eq(zones.locationId, receipt.locationId),
            eq(zones.code, 'HANDLING'),
          ),
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

      await this.inventoryMovementService.recordInventoryMovement(tx, {
        entryNumber: `CAN-${receipt.receiptNumber}`,
        sourceType: 'PO_RECEIPT',
        sourceId: receipt.goodsReceivedId,
        memo: `Cancel Reception ${receipt.receiptNumber}`,
        userId,
        lines: receiptLines.map((lv) => ({
          productId: lv.productId,
          binId: receivingBin.binId,
          quantity: -parseFloat(lv.quantityReceived),
          uomCode: lv.uomCode || lv.baseUom || 'EA',
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
            reversedLines as Parameters<GlService['postJournalEntry']>[0],
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
            sql`UPDATE herobm_core.purchase_order_lines 
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
          true,
        );

        const [po] = await tx
          .select({ orderNumber: purchaseOrders.orderNumber })
          .from(purchaseOrders)
          .where(eq(purchaseOrders.purchaseOrderId, poId));
        // @herobm-skip-audit - DB write is performed via raw tx.execute, false positive
        await emitEvent(tx, {
          entityType: EntityType.PURCHASE_ORDER,
          entityId: poId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: po.orderNumber,
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
      await this.stateService.changeReceiptState(
        goodsReceivedId,
        GOODS_RECEIVED_STATE.CANCELLED,
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
        ].includes(
          poLine.stateCode as
            | 'cancelled'
            | 'invoiced'
            | 'received'
            | 'closed_short',
        )
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

      if (poLine.stateCode !== newState) {
        await this.purchaseOrdersService.changePurchaseOrderState(
          poLine.poId,
          newState as
            | 'cancelled'
            | 'invoiced'
            | 'received'
            | 'closed_short'
            | 'draft'
            | 'ordered'
            | 'partially_received',
          userId,
          tx,
        );
      }

      const [receipt] = await tx
        .select({ receiptNumber: goodsReceived.receiptNumber })
        .from(goodsReceived)
        .where(eq(goodsReceived.goodsReceivedId, grLine.goodsReceivedId));
      await emitEvent(tx, {
        entityType: EntityType.SYSTEM,
        entityId: grLine.goodsReceivedId,
        eventType: EventType.RECEIPT_MATCHED,
        entityDisplayName: receipt.receiptNumber,
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
        newState as
          | 'cancelled'
          | 'invoiced'
          | 'received'
          | 'closed_short'
          | 'draft'
          | 'ordered'
          | 'partially_received',
        userId,
        tx,
      );

      // 4. Emit Event
      const [receipt] = await tx
        .select({ receiptNumber: goodsReceived.receiptNumber })
        .from(goodsReceived)
        .where(eq(goodsReceived.goodsReceivedId, grLine.goodsReceivedId));
      await emitEvent(tx, {
        entityType: EntityType.SYSTEM,
        entityId: grLine.goodsReceivedId,
        eventType: EventType.RECEIPT_UNMATCHED,
        entityDisplayName: receipt.receiptNumber,
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

  /**
   * Update header fields for an existing goods receipt.
   */
  async update(id: string, updateDto: UpdateGoodsReceivedDto, userId: string) {
    return this.db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(goodsReceived)
        .where(eq(goodsReceived.goodsReceivedId, id))
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Goods receipt ${id} not found`);
      }

      if (existing.stateCode === GOODS_RECEIVED_STATE.CANCELLED) {
        throw new BadRequestException('Cannot update a cancelled receipt');
      }

      if (updateDto.vendorId) {
        const [vendor] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.vendorId, updateDto.vendorId))
          .limit(1);
        if (!vendor) {
          throw new NotFoundException(
            `Supplier ${updateDto.vendorId} not found`,
          );
        }
      }

      if (updateDto.locationId) {
        const [location] = await tx
          .select()
          .from(locations)
          .where(eq(locations.locationId, updateDto.locationId))
          .limit(1);
        if (!location) {
          throw new NotFoundException(
            `Location ${updateDto.locationId} not found`,
          );
        }
      }

      const updateData: Partial<typeof goodsReceived.$inferInsert> = {
        modifiedOn: new Date(),
      };
      if (updateDto.vendorId !== undefined) {
        updateData.vendorId = updateDto.vendorId;
      }
      if (updateDto.locationId !== undefined) {
        updateData.locationId = updateDto.locationId;
      }
      if (updateDto.packingSlipNumber !== undefined) {
        updateData.packingSlipNumber = updateDto.packingSlipNumber;
      }
      if (updateDto.notes !== undefined) {
        updateData.notes = updateDto.notes;
      }

      await tx
        .update(goodsReceived)
        .set(updateData)
        .where(eq(goodsReceived.goodsReceivedId, id));

      await emitEvent(tx, {
        entityType: EntityType.WAREHOUSE,
        entityId: id,
        eventType: EventType.UPDATED,
        entityDisplayName: existing.receiptNumber,
        payload: {
          goodsReceivedId: id,
          receiptNumber: existing.receiptNumber,
          changes: updateDto,
        },
        actor: userId,
      });

      return this.coreService.findOne(id, tx);
    });
  }
}
