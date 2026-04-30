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
  locations,
  products,
  purchaseOrders,
  purchaseOrderLineItems,
  zones,
  bins,
} from '../drizzle/modbm-core-schema';

import { InventoryService } from '../inventory/inventory.service';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { eq, and, sql, desc, or, ilike } from 'drizzle-orm';
import { randomUUID } from 'crypto';
import { PaginationQuery, parsePagination } from '../common/pagination';

@Injectable()
export class GoodsReceivedService {
  private readonly logger = new Logger(GoodsReceivedService.name);

  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
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
      // 1. Validate vendor
      const [vendor] = await tx
        .select({ vendorId: suppliers.vendorId, name: suppliers.name })
        .from(suppliers)
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
                sql`${purchaseOrders.stateCode} IN ('ordered', 'partially_received')`,
                sql`CAST(${purchaseOrderLineItems.quantityReceived} AS NUMERIC) < CAST(${purchaseOrderLineItems.quantity} AS NUMERIC)`,
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

        // Recompute PO State for any affected POs
        const updatedPoIds = [
          ...new Set(
            matchedLines.map((l) => l.purchaseOrderId!).filter(Boolean),
          ),
        ];
        for (const poId of updatedPoIds) {
          const poLines = await tx
            .select({
              quantity: purchaseOrderLineItems.quantity,
              quantityReceived: purchaseOrderLineItems.quantityReceived,
            })
            .from(purchaseOrderLineItems)
            .where(eq(purchaseOrderLineItems.purchaseOrderId, poId));

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
            .where(eq(purchaseOrders.purchaseOrderId, poId));
        }
      }

      // 7. Emit audit event
      await emitEvent(tx, {
        aggregateType: AggregateType.SYSTEM,
        aggregateId: receipt.goodsReceivedId,
        eventType: EventType.GOODS_RECEIVED,
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
  async findAllLines(params: PaginationQuery) {
    const { page, limit, offset, searchTerm, days } = parsePagination(params);

    const conditions = [];

    if (searchTerm) {
      conditions.push(
        or(
          ilike(goodsReceived.receiptNumber, searchTerm),
          ilike(goodsReceived.packingSlipNumber, searchTerm),
          ilike(products.productNumber, searchTerm),
          ilike(products.alternateProductNumber, searchTerm),
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
      .where(whereClause);

    return {
      data: data.map((d) => ({
        ...d.line,
        receiptNumber: d.receiptNumber,
        packingSlipNumber: d.packingSlipNumber,
        vendorId: d.vendorId,
        vendorName: d.vendorName,
        createdOn: d.createdOn,
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

      // Update GR Line
      await tx
        .update(goodsReceivedLines)
        .set({
          matchStatus: 'matched',
          purchaseOrderLineId: poLine.poLineId,
          purchaseOrderId: poLine.poId,
        })
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId));

      // Update PO Line
      await tx
        .update(purchaseOrderLineItems)
        .set({
          quantityReceived: sql`CAST(quantity_received AS NUMERIC) + CAST(${grLine.quantityReceived} AS NUMERIC)`,
        })
        .where(eq(purchaseOrderLineItems.purchaseOrderLineId, poLine.poLineId));

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
        eventType: EventType.ALLOCATION_RESOLVED,
        payload: {
          goodsReceivedLineId,
          purchaseOrderLineId: poLine.poLineId,
          purchaseOrderId: poLine.poId,
        },
        actor: userId,
      });

      return { success: true };
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

      // 1. Update GR Line back to ambiguous
      await tx
        .update(goodsReceivedLines)
        .set({
          matchStatus: 'ambiguous',
          purchaseOrderLineId: null,
          purchaseOrderId: null,
        })
        .where(eq(goodsReceivedLines.goodsReceivedLineId, goodsReceivedLineId));

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
        eventType: 'allocation_unresolved',
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
