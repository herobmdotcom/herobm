import {
  isPickableBinSqlCondition,
  isPickableBinCondition,
} from '../inventory/inventory-math.utils';
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
  bins,
  zones,
  binContents,
  locations,
  salesOrderPicks,
  backorders,
  customers as coreAccounts,
  customerGroups,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
  workOrders,
  workOrderComponents,
  workOrderPicks,
  actors,
} from '@herobm/db-schema';
import { findOrder, getCommittedPerLine } from './shipment-helpers';
import { getCreditBlockedSql } from './orders.sql';
import {
  filterPickableBins,
  calculatePickableOnHand,
} from '../inventory/inventory-math.utils';
import {
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_STATE,
  TRANSFER_ORDER_STATE,
  TRANSFER_ORDER_PICK_STATE,
  BACKORDER_STATE,
  WORK_ORDER_STATE,
  WORK_ORDER_PICK_STATE,
} from '@herobm/shared';

@Injectable()
export class PickingQueryService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  /**
   * Get picking summary for an order, including shipped quantities.
   */
  async getPickingSummary(orderId: string) {
    const [, rawLines, creditStatus] = await Promise.all([
      findOrder(this.db, orderId),
      this.db
        .select({
          salesOrderLineId: salesOrderLineItems.salesOrderLineId,
          lineNumber: salesOrderLineItems.lineNumber,
          productId: salesOrderLineItems.productId,
          productDescription: salesOrderLineItems.productDescription,
          quantity: salesOrderLineItems.quantity,
          productNumber: coreProducts.productNumber,
          productType: coreProducts.productType,
          structureType: coreProducts.structureType,
          locationName: locations.name,
          fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
        })
        .from(salesOrderLineItems)
        .leftJoin(
          coreProducts,
          eq(salesOrderLineItems.productId, coreProducts.productId),
        )
        .leftJoin(
          locations,
          eq(salesOrderLineItems.fulfillmentLocationId, locations.locationId),
        )
        .where(eq(salesOrderLineItems.salesOrderId, orderId))
        .orderBy(salesOrderLineItems.lineNumber),
      this.db
        .select({ isCreditBlocked: getCreditBlockedSql() })
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, orderId)),
    ]);

    const lines = rawLines;
    const isCreditBlocked = creditStatus?.[0]?.isCreditBlocked ?? false;
    const lineIds = lines.map((l) => l.salesOrderLineId);
    const productIds = Array.from(
      new Set(lines.map((l) => l.productId).filter(Boolean) as string[]),
    );

    const [committedMap, allocations, binStock, picksRaw] = await Promise.all([
      getCommittedPerLine(this.db, orderId),
      lineIds.length > 0
        ? this.db
            .select({
              salesOrderLineId: backorders.salesOrderLineId,
              productId: backorders.productId,
              allocatedQty:
                sql<number>`COALESCE(SUM(${backorders.quantity}), 0)`.mapWith(
                  Number,
                ),
            })
            .from(backorders)
            .where(
              and(
                inArray(backorders.salesOrderLineId, lineIds),
                eq(backorders.stateCode, BACKORDER_STATE.RECEIVED_RESERVED),
              ),
            )
            .groupBy(backorders.salesOrderLineId, backorders.productId)
        : Promise.resolve(
            [] as {
              salesOrderLineId: string;
              productId: string;
              allocatedQty: number;
            }[],
          ),
      productIds.length > 0
        ? this.db
            .select({
              productId: binContents.productId,
              locationId: zones.locationId,
              zoneCode: zones.code,
              binId: bins.binId,
              binNumber: bins.binNumber,
              binType: bins.binType,
              isUnavailable: bins.isUnavailable,
              onHand: binContents.actualQuantity,
            })
            .from(binContents)
            .innerJoin(bins, eq(binContents.binId, bins.binId))
            .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
            .where(inArray(binContents.productId, productIds))
        : Promise.resolve(
            [] as {
              productId: string;
              locationId: string;
              zoneCode: string;
              binId: string;
              binNumber: string;
              binType: string;
              isUnavailable: boolean;
              onHand: string;
            }[],
          ),
      this.db
        .select({
          pick: salesOrderPicks,
          binName: bins.binNumber,
        })
        .from(salesOrderPicks)
        .leftJoin(bins, eq(salesOrderPicks.binId, bins.binId))
        .where(eq(salesOrderPicks.salesOrderId, orderId)),
    ]);

    const allocationMap = new Map(
      allocations.map((a) => [
        `${a.salesOrderLineId}_${a.productId}`,
        a.allocatedQty,
      ]),
    );

    const picks = picksRaw.map((p) => ({
      ...p.pick,
      binName: p.binName,
    }));

    const pickedMap = new Map<string, number>();
    for (const pick of picks) {
      if (pick.stateCode !== SALES_ORDER_PICK_STATE.CANCELLED) {
        const key = `${pick.salesOrderLineId}_${pick.productId}`;
        const current = pickedMap.get(key) || 0;
        pickedMap.set(key, current + parseFloat(pick.quantity));
      }
    }

    const summary = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const isStocked =
        Boolean(line.productId) &&
        (!line.productType || line.productType === 'inventory');
      const isPhysical =
        !line.productType ||
        (line.productType !== 'service' && line.productType !== 'freight');
      const key = `${line.salesOrderLineId}_${line.productId}`;
      const picked = isStocked ? (pickedMap.get(key) ?? 0) : ordered;
      const committed = isPhysical
        ? (committedMap.get(line.salesOrderLineId) ?? 0)
        : ordered;

      const productLocationBins = isStocked
        ? binStock.filter(
            (s) =>
              s.productId === line.productId &&
              s.locationId === line.fulfillmentLocationId,
          )
        : [];

      const availableBins = filterPickableBins(productLocationBins)
        .sort(
          (a, b) =>
            parseFloat(String(b.onHand || 0)) -
            parseFloat(String(a.onHand || 0)),
        )
        .map((b) => ({
          binId: b.binId,
          binName: `${b.zoneCode}.${b.binNumber}`,
          onHand: String(b.onHand || 0),
        }));

      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productType: line.productType,
        productDescription: line.productDescription,
        locationName: line.locationName || 'System Default',
        quantity: line.quantity,
        quantityPicked: isStocked ? String(picked) : String(ordered),
        quantityShipped: String(committed),
        remaining: String(ordered - picked),
        isFullyPicked: picked >= ordered,
        isPhysical: isStocked,
        isStocked,
        onHand: String(calculatePickableOnHand(productLocationBins)),
        availableBins,
        hasAllocation: (allocationMap.get(key) ?? 0) > 0,
      };
    });

    const filteredSummary = summary.filter((s) => parseFloat(s.quantity) > 0);
    const activeStockedLines = filteredSummary.filter(
      (s) =>
        Boolean(s.productId) &&
        (!s.productType || s.productType === 'inventory'),
    );

    const totalLines = activeStockedLines.length;
    const fullyPickedLines = activeStockedLines.filter(
      (s) => s.isFullyPicked,
    ).length;

    return {
      isCreditBlocked: Boolean(isCreditBlocked),
      totalLines,
      fullyPickedLines,
      isFullyPicked: totalLines > 0 && fullyPickedLines === totalLines,
      lines: filteredSummary,
      picks,
    };
  }

  async assertFullyPicked(orderId: string): Promise<void> {
    const summary = await this.getPickingSummary(orderId);

    const unpicked = summary.lines.filter((l) => {
      const ordered = parseFloat(l.quantity);
      const picked = parseFloat(l.quantityPicked ?? '0');
      return picked < ordered;
    });

    if (unpicked.length > 0) {
      const details = unpicked.map(
        (l) =>
          `line ${l.lineNumber}: picked ${l.quantityPicked ?? '0'} of ${l.quantity}`,
      );
      throw new BadRequestException(
        `Cannot transition to '${SALES_ORDER_STATE.SHIPPED}' - ${unpicked.length} line(s) not fully picked: ${details.join('; ')}`,
      );
    }
  }

  async assertFullyShipped(orderId: string): Promise<void> {
    const summary = await this.getPickingSummary(orderId);

    const unshipped = summary.lines.filter((l) => {
      if (!l.isPhysical) return false;
      const ordered = parseFloat(l.quantity);
      const shipped = parseFloat(l.quantityShipped ?? '0');
      return shipped < ordered;
    });

    if (unshipped.length > 0) {
      const details = unshipped.map(
        (l) =>
          `line ${l.lineNumber}: shipped ${l.quantityShipped ?? '0'} of ${l.quantity}`,
      );
      throw new BadRequestException(
        `Cannot transition to '${SALES_ORDER_STATE.SHIPPED}' - ${unshipped.length} line(s) not fully shipped: ${details.join('; ')}`,
      );
    }
  }

  async getPickingQueue(
    query?:
      | {
          locationId?: string;
          status?: string;
          page?: number;
          limit?: number;
        }
      | string,
  ) {
    const locationId = typeof query === 'string' ? query : query?.locationId;
    const [rawLines, rawTransferLines, rawWorkOrderLines] = await Promise.all([
      this.db
        .select({
          id: salesOrders.salesOrderId,
          orderNumber: salesOrders.orderNumber,
          name: salesOrders.name,
          customerName: actors.name,
          customerOrderNumber: salesOrders.customerOrderNumber,
          stateCode: salesOrders.stateCode,
          createdOn: salesOrders.createdOn,
          createdBy: salesOrders.createdBy,
          currencyCode: salesOrders.currencyCode,
          isCreditBlocked: sql<boolean>`false`,
          lineId: salesOrderLineItems.salesOrderLineId,
          productId: salesOrderLineItems.productId,
          fulfillmentLocationId: salesOrderLineItems.fulfillmentLocationId,
          lineQuantity: salesOrderLineItems.quantity,
          isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' THEN true ELSE false END`,
        })
        .from(salesOrders)
        .innerJoin(
          salesOrderLineItems,
          eq(salesOrders.salesOrderId, salesOrderLineItems.salesOrderId),
        )
        .leftJoin(
          coreAccounts,
          eq(salesOrders.customerId, coreAccounts.customerId),
        )
        .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
        .leftJoin(
          customerGroups,
          eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
        )
        .leftJoin(
          coreProducts,
          eq(salesOrderLineItems.productId, coreProducts.productId),
        )
        .where(
          and(
            inArray(salesOrders.stateCode, [
              SALES_ORDER_STATE.CONFIRMED,
              SALES_ORDER_STATE.PICKING,
            ]),
            locationId
              ? eq(salesOrderLineItems.fulfillmentLocationId, locationId)
              : undefined,
          ),
        )
        .orderBy(salesOrders.createdOn),

      this.db
        .select({
          id: transferOrders.transferOrderId,
          orderNumber: transferOrders.orderNumber,
          name: sql<string>`'Internal Transfer'`,
          customerName: locations.name,
          customerOrderNumber: sql<string>`'N/A'`,
          stateCode: transferOrders.stateCode,
          createdOn: transferOrders.createdOn,
          createdBy: transferOrders.createdBy,
          currencyCode: sql<string>`'N/A'`,
          isCreditBlocked: sql<boolean>`false`,
          lineId: transferOrderLines.transferOrderLineId,
          productId: transferOrderLines.productId,
          fulfillmentLocationId: transferOrders.sourceLocationId,
          lineQuantity: transferOrderLines.quantity,
          isPhysical: sql<boolean>`CASE WHEN ${coreProducts.productType} = 'inventory' THEN true ELSE false END`,
          type: sql<string>`'transfer_order'`,
        })
        .from(transferOrders)
        .innerJoin(
          transferOrderLines,
          eq(
            transferOrders.transferOrderId,
            transferOrderLines.transferOrderId,
          ),
        )
        .leftJoin(
          locations,
          eq(transferOrders.destinationLocationId, locations.locationId),
        )
        .leftJoin(
          coreProducts,
          eq(transferOrderLines.productId, coreProducts.productId),
        )
        .where(
          and(
            inArray(transferOrders.stateCode, [
              TRANSFER_ORDER_STATE.CONFIRMED,
              TRANSFER_ORDER_STATE.PICKING,
            ]),
            locationId
              ? eq(transferOrders.sourceLocationId, locationId)
              : undefined,
          ),
        ),

      this.db
        .select({
          id: workOrders.workOrderId,
          orderNumber: workOrders.orderNumber,
          name: coreProducts.name,
          customerName: locations.name,
          customerOrderNumber: sql<string>`'N/A'`,
          stateCode: workOrders.stateCode,
          createdOn: workOrders.createdOn,
          createdBy: workOrders.createdBy,
          currencyCode: sql<string>`'N/A'`,
          isCreditBlocked: sql<boolean>`false`,
          lineId: workOrderComponents.workOrderComponentId,
          productId: workOrderComponents.productId,
          fulfillmentLocationId: workOrders.locationId,
          lineQuantity: workOrderComponents.expectedQuantity,
          isPhysical: sql<boolean>`true`,
          type: sql<string>`'work_order'`,
        })
        .from(workOrders)
        .innerJoin(
          workOrderComponents,
          eq(workOrders.workOrderId, workOrderComponents.workOrderId),
        )
        .leftJoin(locations, eq(workOrders.locationId, locations.locationId))
        .leftJoin(
          coreProducts,
          eq(workOrders.productId, coreProducts.productId),
        )
        .where(
          and(
            eq(workOrders.stateCode, WORK_ORDER_STATE.IN_PROGRESS),
            locationId ? eq(workOrders.locationId, locationId) : undefined,
          ),
        ),
    ]);

    const soLineIds = rawLines.map((r) => r.lineId);
    const toLineIds = rawTransferLines.map((r) => r.lineId);
    const woComponentIds = rawWorkOrderLines.map((r) => r.lineId);
    const allProductIds: string[] = Array.from(
      new Set(
        [...rawLines, ...rawTransferLines, ...rawWorkOrderLines]
          .map((r) => r.productId)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const [soPicks, toPicks, woPicks, allocatedBackorderLines, stockRows] =
      await Promise.all([
        soLineIds.length > 0
          ? this.db
              .select({
                lineId: salesOrderPicks.salesOrderLineId,
                pickedQty:
                  sql<number>`COALESCE(SUM(${salesOrderPicks.quantity}), 0)`.mapWith(
                    Number,
                  ),
              })
              .from(salesOrderPicks)
              .where(
                and(
                  inArray(salesOrderPicks.salesOrderLineId, soLineIds),
                  sql`${salesOrderPicks.stateCode} != ${SALES_ORDER_PICK_STATE.CANCELLED}`,
                ),
              )
              .groupBy(salesOrderPicks.salesOrderLineId)
          : Promise.resolve([]),

        toLineIds.length > 0
          ? this.db
              .select({
                lineId: transferOrderPicks.transferOrderLineId,
                pickedQty:
                  sql<number>`COALESCE(SUM(${transferOrderPicks.quantity}), 0)`.mapWith(
                    Number,
                  ),
              })
              .from(transferOrderPicks)
              .where(
                and(
                  inArray(transferOrderPicks.transferOrderLineId, toLineIds),
                  sql`${transferOrderPicks.stateCode} != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}`,
                ),
              )
              .groupBy(transferOrderPicks.transferOrderLineId)
          : Promise.resolve([]),

        woComponentIds.length > 0
          ? this.db
              .select({
                lineId: workOrderPicks.workOrderComponentId,
                pickedQty:
                  sql<number>`COALESCE(SUM(${workOrderPicks.quantity}), 0)`.mapWith(
                    Number,
                  ),
              })
              .from(workOrderPicks)
              .where(
                and(
                  inArray(workOrderPicks.workOrderComponentId, woComponentIds),
                  eq(workOrderPicks.stateCode, WORK_ORDER_PICK_STATE.PICKED),
                ),
              )
              .groupBy(workOrderPicks.workOrderComponentId)
          : Promise.resolve([]),

        soLineIds.length > 0
          ? this.db
              .select({ lineId: backorders.salesOrderLineId })
              .from(backorders)
              .where(
                and(
                  inArray(backorders.salesOrderLineId, soLineIds),
                  eq(backorders.stateCode, BACKORDER_STATE.RECEIVED_RESERVED),
                ),
              )
          : Promise.resolve([]),

        allProductIds.length > 0
          ? this.db
              .select({
                productId: binContents.productId,
                locationId: zones.locationId,
                onHand:
                  sql<number>`COALESCE(SUM(${binContents.actualQuantity}), 0)`.mapWith(
                    Number,
                  ),
              })
              .from(binContents)
              .innerJoin(bins, eq(binContents.binId, bins.binId))
              .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
              .where(
                and(
                  inArray(binContents.productId, allProductIds),
                  isPickableBinCondition(bins),
                ),
              )
              .groupBy(binContents.productId, zones.locationId)
          : Promise.resolve([]),
      ]);

    const picksMap = new Map<string, number>();
    for (const p of soPicks) picksMap.set(p.lineId, p.pickedQty);
    for (const p of toPicks) picksMap.set(p.lineId, p.pickedQty);
    for (const p of woPicks) picksMap.set(p.lineId, p.pickedQty);

    const allocatedSet = new Set<string>();
    for (const a of allocatedBackorderLines) {
      if (a.lineId) allocatedSet.add(a.lineId);
    }

    const stockMap = new Map<string, number>();
    for (const s of stockRows)
      stockMap.set(`${s.productId}_${s.locationId}`, s.onHand);

    const allLines = [
      ...rawLines.map((r) => ({
        ...r,
        type: 'sales_order',
        onHand: stockMap.get(`${r.productId}_${r.fulfillmentLocationId}`) || 0,
        pickedQty: picksMap.get(r.lineId) || 0,
        hasAllocation: allocatedSet.has(r.lineId),
      })),
      ...rawTransferLines.map((r) => ({
        ...r,
        onHand: stockMap.get(`${r.productId}_${r.fulfillmentLocationId}`) || 0,
        pickedQty: picksMap.get(r.lineId) || 0,
        hasAllocation: false,
      })),
      ...rawWorkOrderLines.map((r) => ({
        ...r,
        onHand: stockMap.get(`${r.productId}_${r.fulfillmentLocationId}`) || 0,
        pickedQty: picksMap.get(r.lineId) || 0,
        hasAllocation: false,
      })),
    ];

    const orderMap = new Map<
      string,
      Record<string, unknown> & {
        id: string;
        orderNumber: string;
        name: string | null;
        customerName: string | null;
        customerOrderNumber: string | null;
        stateCode: string;
        createdOn: Date | null;
        createdBy: string | null;
        totalPrice: string | null;
        currencyCode: string | null;
        isCreditBlocked: boolean;
        type: string;
        _hasAllocation?: boolean;
        _linesUnfulfilled?: number;
        _linesFullyPickable?: number;
        _linesPartiallyPickable?: number;
      }
    >();

    for (const row of allLines) {
      if (!orderMap.has(row.id)) {
        orderMap.set(row.id, {
          id: row.id,
          orderNumber: row.orderNumber,
          name: row.name,
          customerName: row.customerName,
          customerOrderNumber: row.customerOrderNumber,
          // eslint-disable-next-line no-restricted-syntax -- State initialization on map object result.
          stateCode: row.stateCode,
          createdOn: row.createdOn,
          createdBy: row.createdBy,
          totalPrice: null,
          currencyCode: row.currencyCode,
          isCreditBlocked: row.isCreditBlocked,
          _linesUnfulfilled: 0,
          _linesFullyPickable: 0,
          _linesPartiallyPickable: 0,
          _hasAllocation: false,
          type: row.type,
        });
      }

      const order = orderMap.get(row.id);
      if (!order) continue;

      if (row.hasAllocation) {
        order._hasAllocation = true;
      }
      if (row.isPhysical) {
        const required = parseFloat(row.lineQuantity ?? '0');
        const picked = parseFloat(row.pickedQty?.toString() ?? '0');
        const remaining = required - picked;

        if (remaining > 0) {
          order._linesUnfulfilled = (order._linesUnfulfilled || 0) + 1;
          const onHand = parseFloat(row.onHand?.toString() ?? '0');

          if (onHand >= remaining) {
            order._linesFullyPickable = (order._linesFullyPickable || 0) + 1;
          } else if (onHand > 0) {
            order._linesPartiallyPickable =
              (order._linesPartiallyPickable || 0) + 1;
          }
        }
      }
    }

    const queue = Array.from(orderMap.values())
      .filter((order) => (order._linesUnfulfilled || 0) > 0)
      .map((order) => {
        let pickabilityStatus: 'ready' | 'partial' | 'blocked';

        if (order._linesFullyPickable === order._linesUnfulfilled) {
          pickabilityStatus = 'ready';
        } else if (
          (order._linesFullyPickable || 0) > 0 ||
          (order._linesPartiallyPickable || 0) > 0
        ) {
          pickabilityStatus = 'partial';
        } else {
          pickabilityStatus = 'blocked';
        }

        const hasAllocation = order._hasAllocation;
        delete order._linesUnfulfilled;
        delete order._linesFullyPickable;
        delete order._linesPartiallyPickable;
        delete order._hasAllocation;

        return {
          ...order,
          pickabilityStatus,
          hasAllocation,
        };
      });

    queue.sort((a, b) => {
      if (a.hasAllocation !== b.hasAllocation) {
        return a.hasAllocation ? -1 : 1;
      }
      return 0;
    });

    const readyCount = queue.filter(
      (o) => o.pickabilityStatus === 'ready',
    ).length;
    const partialCount = queue.filter(
      (o) => o.pickabilityStatus === 'partial',
    ).length;
    const blockedCount = queue.filter(
      (o) => o.pickabilityStatus === 'blocked',
    ).length;

    const requestedStatus =
      (typeof query === 'object' ? query?.status : undefined) || 'all';
    const filteredQueue =
      requestedStatus && requestedStatus !== 'all'
        ? queue.filter((o) => o.pickabilityStatus === requestedStatus)
        : queue;

    const page = Math.max(
      1,
      Number(typeof query === 'object' ? query?.page : 1) || 1,
    );
    const limit = Math.max(
      1,
      Math.min(
        100,
        Number(typeof query === 'object' ? query?.limit : 20) || 20,
      ),
    );
    const total = filteredQueue.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const paginatedData = filteredQueue.slice(startIndex, startIndex + limit);

    return {
      data: paginatedData,
      meta: {
        total,
        page,
        limit,
        totalPages,
        readyCount,
        partialCount,
        blockedCount,
      },
    };
  }
}
