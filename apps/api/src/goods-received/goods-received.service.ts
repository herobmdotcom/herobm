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

@Injectable()
export class GoodsReceivedService {
  private readonly logger = new Logger(GoodsReceivedService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
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
          stateCode: 'received',
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
                sql`${purchaseOrders.stateCode} IN ('ordered', 'partially_received')`,
                sql`CAST(${purchaseOrderLineItems.quantityReceived} AS NUMERIC) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
                sql`CAST(${purchaseOrderLineItems.quantity} AS NUMERIC) - CAST(COALESCE(${purchaseOrderLineItems.quantityReceived}, '0') AS NUMERIC) >= CAST(${line.quantityReceived} AS NUMERIC)`,
              ),
            );

          let matchStatus: string;
          let matchedPoLineId: string | null = null;
          let matchedPoId: string | null = null;

          if (openPoLines.length === 1) {
            matchStatus = 'matched';
            matchedPoLineId = openPoLines[0].purchaseOrderLineId;
            matchedPoId = openPoLines[0].purchaseOrderId;
          } else if (openPoLines.length > 1) {
            matchStatus = 'ambiguous';
          } else {
            matchStatus = 'unmatched';
          }

          const unitCost = matchedPoLineId ? openPoLines[0].pricePerUnit : null;

          lineValues.push({
            goodsReceivedId: receipt.goodsReceivedId,
            productId: line.productId,
            quantityReceived: line.quantityReceived.toString(),
            matchStatus,
            putawayStatus:
              matchStatus === 'matched'
                ? 'pending_putaway'
                : 'awaiting_matching',
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
          (l) => l.matchStatus === 'matched',
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
                eq(backorders.stateCode, 'awaiting_receipt'),
              ),
            );

          let receiptRemaining = parseFloat(ml.quantityReceived);

          for (const bo of awaitingBackorders) {
            if (receiptRemaining <= 0) break;
            const boQty = parseFloat(bo.quantity);

            if (receiptRemaining >= boQty) {
              // Fully fulfilled — transition entire backorder
              await tx
                .update(backorders)
                .set({ stateCode: 'received_reserved', modifiedOn: new Date() })
                .where(eq(backorders.backorderId, bo.backorderId));
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
                stateCode: 'received_reserved',
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
      if (grLine.matchStatus === 'matched')
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
        ['received', 'invoiced', 'cancelled', 'closed_short'].includes(
          poLine.stateCode || '',
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
          matchStatus: 'matched',
          // ADV-086: Preserve quarantined status if set — matching doesn't clear quarantine
          putawayStatus:
            grLine.putawayStatus === 'quarantined'
              ? 'quarantined'
              : 'pending_putaway',
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
            matchStatus: 'ambiguous',
            putawayStatus: 'awaiting_matching',
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
            eq(backorders.stateCode, 'awaiting_receipt'),
          ),
        );

      let receiptRemaining = targetQuantity;

      for (const bo of awaitingBackorders) {
        if (receiptRemaining <= 0) break;
        const boQty = parseFloat(bo.quantity);

        if (receiptRemaining >= boQty) {
          await tx
            .update(backorders)
            .set({ stateCode: 'received_reserved', modifiedOn: new Date() })
            .where(eq(backorders.backorderId, bo.backorderId));
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
            stateCode: 'received_reserved',
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

      await tx
        .update(purchaseOrders)
        .set({
          stateCode: allFullyReceived ? 'received' : 'partially_received',
        })
        .where(eq(purchaseOrders.purchaseOrderId, poLine.poId));

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
      if (grLine.matchStatus !== 'matched' || !grLine.purchaseOrderLineId) {
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
            sql`${goodsReceivedLines.matchStatus} != 'matched'`,
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
            matchStatus: 'ambiguous',
            putawayStatus:
              grLine.putawayStatus === 'quarantined'
                ? 'quarantined'
                : 'awaiting_matching',
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

      await tx
        .update(purchaseOrders)
        .set({
          stateCode: allFullyReceived
            ? 'received'
            : anyReceived
              ? 'partially_received'
              : 'ordered',
        })
        .where(eq(purchaseOrders.purchaseOrderId, poLine.poId));

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

  async toggleQuarantine(
    goodsReceivedLineId: string,
    userId: string,
    reason?: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const [grLine] = await tx
        .select({
          line: goodsReceivedLines,
          locationId: goodsReceived.locationId,
          receiptNumber: goodsReceived.receiptNumber,
        })
        .from(goodsReceivedLines)
        .innerJoin(
          goodsReceived,
          eq(goodsReceivedLines.goodsReceivedId, goodsReceived.goodsReceivedId),
        )
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId))
        .limit(1);

      if (!grLine) throw new NotFoundException('Line not found');

      const currentStatus = grLine.line.putawayStatus;
      if (currentStatus === 'completed') {
        throw new BadRequestException(
          'Cannot quarantine an already putaway line',
        );
      }

      // ADV-086: Context-aware status restoration
      // When un-quarantining, restore to 'pending_putaway' only if matched to a PO;
      // otherwise restore to 'awaiting_matching' to prevent unmatched items
      // from bypassing the allocation stage.
      let newStatus: 'quarantined' | 'pending_putaway' | 'awaiting_matching';
      if (currentStatus === 'quarantined') {
        newStatus = grLine.line.purchaseOrderLineId
          ? 'pending_putaway'
          : 'awaiting_matching';
      } else {
        newStatus = 'quarantined';
      }
      const targetBinCode =
        newStatus === 'quarantined' ? 'QUARANTINE' : 'RECEIVING';
      const currentBinCode =
        currentStatus === 'quarantined' ? 'QUARANTINE' : 'RECEIVING';

      // Find the zones/bins
      const [sourceBin] = await tx
        .select({ binId: bins.binId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, grLine.locationId),
            eq(bins.binNumber, currentBinCode),
          ),
        )
        .limit(1);

      let targetBin = await tx
        .select({ binId: bins.binId, zoneId: bins.zoneId })
        .from(bins)
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            eq(zones.locationId, grLine.locationId),
            eq(bins.binNumber, targetBinCode),
          ),
        )
        .limit(1)
        .then((res) => res[0]);

      if (!targetBin) {
        // Find or create zone
        let targetZone = await tx
          .select({ zoneId: zones.zoneId })
          .from(zones)
          .where(
            and(
              eq(zones.locationId, grLine.locationId),
              eq(zones.code, targetBinCode === 'QUARANTINE' ? 'QUAR' : 'RECV'),
            ),
          )
          .limit(1)
          .then((res) => res[0]);

        if (!targetZone) {
          const [newZone] = await tx
            .insert(zones)
            .values({
              locationId: grLine.locationId,
              code: targetBinCode === 'QUARANTINE' ? 'QUAR' : 'RECV',
              name:
                targetBinCode === 'QUARANTINE'
                  ? 'Quarantine Zone'
                  : 'Receiving Dock',
              createdBy: userId,
            })
            .returning();
          targetZone = newZone;
        }

        const [newBin] = await tx
          .insert(bins)
          .values({
            zoneId: targetZone.zoneId,
            binNumber: targetBinCode,
            binType:
              targetBinCode === 'QUARANTINE' ? 'quarantine' : 'receiving',
            createdBy: userId,
          })
          .returning();
        targetBin = newBin;
      }

      // ADV-086: Strict bin validation — never update status without a ledger movement
      if (!sourceBin) {
        throw new BadRequestException(
          `Source bin '${currentBinCode}' not found for this location. Cannot toggle quarantine.`,
        );
      }

      await this.inventoryService.recordInventoryMovement(tx, {
        entryNumber: `QRN-${grLine.receiptNumber}-${grLine.line.goodsReceivedLineId.substring(0, 4)}`,
        sourceType: 'PO_RECEIPT',
        sourceId: grLine.line.goodsReceivedId,
        memo: reason
          ? `Status: ${newStatus} - ${reason}`
          : `Status: ${newStatus}`,
        userId,
        lines: [
          {
            productId: grLine.line.productId,
            binId: sourceBin.binId,
            quantity: -parseFloat(grLine.line.quantityReceived),
          },
          {
            productId: grLine.line.productId,
            binId: targetBin.binId,
            quantity: parseFloat(grLine.line.quantityReceived),
          },
        ],
      });

      await tx
        .update(goodsReceivedLines)
        .set({ putawayStatus: newStatus })
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId));

      return { success: true, putawayStatus: newStatus };
    });
  }

  async putaway(dto: import('./dto').PutawayBulkDto, userId: string) {
    return await this.db.transaction(async (tx) => {
      for (const lineDto of dto.putaways) {
        const [grLine] = await tx
          .select({
            line: goodsReceivedLines,
            locationId: goodsReceived.locationId,
            receiptNumber: goodsReceived.receiptNumber,
          })
          .from(goodsReceivedLines)
          .innerJoin(
            goodsReceived,
            eq(
              goodsReceivedLines.goodsReceivedId,
              goodsReceived.goodsReceivedId,
            ),
          )
          .where(eq(goodsReceivedLines.goodsReceivedLineId, lineDto.lineId))
          .limit(1);

        if (!grLine)
          throw new NotFoundException(`Line ${lineDto.lineId} not found`);
        if (grLine.line.matchStatus !== 'matched') {
          throw new BadRequestException(
            `Cannot putaway unmatched line: ${lineDto.lineId}`,
          );
        }
        if (grLine.line.putawayStatus === 'completed') {
          throw new BadRequestException(
            `Line ${lineDto.lineId} is already putaway`,
          );
        }

        const sourceBinCode =
          grLine.line.putawayStatus === 'quarantined'
            ? 'QUARANTINE'
            : 'RECEIVING';

        const [sourceBin] = await tx
          .select({ binId: bins.binId })
          .from(bins)
          .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
          .where(
            and(
              eq(zones.locationId, grLine.locationId),
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

        const movements: any[] = [
          {
            productId: grLine.line.productId,
            binId: sourceBin.binId,
            quantity: -qty,
          },
          {
            productId: grLine.line.productId,
            binId: lineDto.destinationBinId,
            quantity: qty,
          },
        ];

        // Handle discrepancies if newTotalQuantity is provided
        if (lineDto.newTotalQuantity !== undefined) {
          const newTotal = parseFloat(lineDto.newTotalQuantity);

          const [destBinContent] = await tx
            .select({ actualQuantity: binContents.actualQuantity })
            .from(binContents)
            .where(
              and(
                eq(binContents.productId, grLine.line.productId),
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
              productId: grLine.line.productId,
              binId: lineDto.destinationBinId,
              quantity: discrepancy,
            });
            this.logger.warn(
              `Putaway discrepancy adjustment created. Expected: ${expectedTotal}, Counted: ${newTotal}, Adj: ${discrepancy}`,
            );
          }
        }

        await this.inventoryService.recordInventoryMovement(tx, {
          entryNumber: `PUT-${grLine.receiptNumber}-${grLine.line.goodsReceivedLineId.substring(0, 4)}`,
          sourceType: 'PO_RECEIPT',
          sourceId: grLine.line.goodsReceivedId,
          memo: `Putaway to ${lineDto.destinationBinId}`,
          userId,
          lines: movements,
        });

        await tx
          .update(goodsReceivedLines)
          .set({ putawayStatus: 'completed' })
          .where(eq(goodsReceivedLines.goodsReceivedLineId, lineDto.lineId));
      }

      return { success: true };
    });
  }
}
