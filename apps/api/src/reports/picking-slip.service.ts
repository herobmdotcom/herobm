import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
  inventoryLevels,
  customers as coreAccounts,
  salesOrderPicks,
  binContents,
  bins,
  zones,
  locations,
  transferOrders,
  transferOrderLines,
  transferOrderPicks,
} from '../drizzle/modbm-core-schema';
import {
  SALES_ORDER_PICK_STATE,
  TRANSFER_ORDER_PICK_STATE,
} from '@modbm/shared';

// ─── Data shapes ────────────────────────────────────────────────────────────

export interface PickingSlipHeader {
  orderNumber: string;
  customerName: string;
  customerOrderNumber: string;
  orderDate: string;
  locationName: string;
}

export interface PickingLine {
  productCode: string;
  description: string;
  binNumber: string;
  qtyToPick: number;
}

export interface BackOrderLine {
  productCode: string;
  description: string;
  qtyToOrder: number;
}

export interface PickingSlipData {
  header: PickingSlipHeader;
  pickingLines: PickingLine[];
  backOrderLines: BackOrderLine[];
  generatedAt: string;
}

// Internal raw data shapes for shared processing
interface RawOrderHeader {
  orderNumber: string;
  customerName: string;
  customerOrderNumber: string;
  createdOn: Date | null;
  locationName: string;
}

interface RawLine {
  lineId: string;
  productId: string | null;
  productNumber: string | null;
  productDescription: string | null;
  quantity: string;
}

interface RawPick {
  lineId: string;
  quantity: string;
}

@Injectable()
export class PickingSlipService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private readonly logger = new Logger(PickingSlipService.name);

  /**
   * Query all required data for the picking slip.
   * Dynamically routes to the correct data loader based on the order type.
   */
  async assembleData(orderId: string): Promise<PickingSlipData> {
    // 1. Try to find as a Sales Order
    const [salesOrder] = await this.db
      .select({ id: salesOrders.salesOrderId })
      .from(salesOrders)
      .where(eq(salesOrders.salesOrderId, orderId))
      .limit(1);

    if (salesOrder) {
      return this.assembleSalesOrderData(orderId);
    }

    // 2. Try to find as a Transfer Order
    const [transferOrder] = await this.db
      .select({ id: transferOrders.transferOrderId })
      .from(transferOrders)
      .where(eq(transferOrders.transferOrderId, orderId))
      .limit(1);

    if (transferOrder) {
      return this.assembleTransferOrderData(orderId);
    }

    throw new NotFoundException(`Order '${orderId}' not found`);
  }

  /**
   * Data loader for Sales Orders
   */
  private async assembleSalesOrderData(
    orderId: string,
  ): Promise<PickingSlipData> {
    const orderRows = await this.db
      .select({
        orderNumber: salesOrders.orderNumber,
        customerName: coreAccounts.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        createdOn: salesOrders.createdOn,
        locationName: locations.name,
      })
      .from(salesOrders)
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(
        locations,
        eq(salesOrders.fulfillmentLocationId, locations.locationId),
      )
      .where(eq(salesOrders.salesOrderId, orderId))
      .limit(1);

    if (orderRows.length === 0)
      throw new NotFoundException(`Sales Order '${orderId}' not found`);
    const order = {
      ...orderRows[0],
      customerName: orderRows[0].customerName ?? '',
      locationName: orderRows[0].locationName ?? '',
      customerOrderNumber: orderRows[0].customerOrderNumber ?? '',
    };

    const lines = await this.db
      .select({
        lineId: salesOrderLineItems.salesOrderLineId,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    const picks = await this.db
      .select({
        lineId: salesOrderPicks.salesOrderLineId,
        quantity: salesOrderPicks.quantity,
      })
      .from(salesOrderPicks)
      .where(
        and(
          eq(salesOrderPicks.salesOrderId, orderId),
          sql`${salesOrderPicks.stateCode} != ${SALES_ORDER_PICK_STATE.CANCELLED}`,
        ),
      );

    return this.computePickingSlipData(order, lines, picks);
  }

  /**
   * Data loader for Transfer Orders
   */
  private async assembleTransferOrderData(
    orderId: string,
  ): Promise<PickingSlipData> {
    const orderRows = await this.db
      .select({
        orderNumber: transferOrders.orderNumber,
        customerName: locations.name, // For transfers, destination is shown as "customer"
        customerOrderNumber: sql<string>`''`,
        createdOn: transferOrders.createdOn,
        locationName: sql<string>`src.name`,
      })
      .from(transferOrders)
      .leftJoin(
        locations,
        eq(transferOrders.destinationLocationId, locations.locationId),
      )
      .leftJoin(
        sql`${locations} as src`,
        eq(transferOrders.sourceLocationId, sql`src.location_id`),
      )
      .where(eq(transferOrders.transferOrderId, orderId))
      .limit(1);

    if (orderRows.length === 0)
      throw new NotFoundException(`Transfer Order '${orderId}' not found`);
    const order = {
      ...orderRows[0],
      customerName: orderRows[0].customerName ?? '',
      locationName: orderRows[0].locationName ?? '',
    };

    const lines = await this.db
      .select({
        lineId: transferOrderLines.transferOrderLineId,
        productId: transferOrderLines.productId,
        productNumber: coreProducts.productNumber,
        productDescription: coreProducts.name,
        quantity: transferOrderLines.quantity,
      })
      .from(transferOrderLines)
      .leftJoin(
        coreProducts,
        eq(transferOrderLines.productId, coreProducts.productId),
      )
      .where(eq(transferOrderLines.transferOrderId, orderId));

    const picks = await this.db
      .select({
        lineId: transferOrderPicks.transferOrderLineId,
        quantity: transferOrderPicks.quantity,
      })
      .from(transferOrderPicks)
      .where(
        and(
          eq(transferOrderPicks.transferOrderId, orderId),
          sql`${transferOrderPicks.stateCode} != ${TRANSFER_ORDER_PICK_STATE.CANCELLED}`,
        ),
      );

    return this.computePickingSlipData(order, lines, picks);
  }

  /**
   * Shared business logic for computing picking lines and backorder logic
   */
  private async computePickingSlipData(
    header: RawOrderHeader,
    lines: RawLine[],
    picks: RawPick[],
  ): Promise<PickingSlipData> {
    const productIds = lines
      .map((l) => l.productId)
      .filter((id): id is string => id !== null && id !== undefined);

    const lineIds = lines.map((l) => l.lineId);

    // 1. Resolve Bins
    const binMap = new Map<string, string>();
    if (productIds.length > 0) {
      const binRows = await this.db
        .select({
          productId: binContents.productId,
          binNumber: bins.binNumber,
          zoneCode: zones.code,
        })
        .from(binContents)
        .innerJoin(bins, eq(binContents.binId, bins.binId))
        .innerJoin(zones, eq(bins.zoneId, zones.zoneId))
        .where(
          and(
            inArray(binContents.productId, productIds),
            eq(bins.isUnavailable, false),
            inArray(bins.binType, ['storage', 'pick', 'bulk']),
          ),
        );

      for (const row of binRows) {
        if (!binMap.has(row.productId)) {
          binMap.set(row.productId, `${row.zoneCode}.${row.binNumber}`);
        }
      }
    }

    // 2. Resolve Picked Quantities
    const pickedMap = new Map<string, number>();
    for (const p of picks) {
      pickedMap.set(
        p.lineId,
        (pickedMap.get(p.lineId) || 0) + parseFloat(p.quantity),
      );
    }

    // 3. Resolve On-Hand Stock (for backorder logic)
    const onHandMap = new Map<string, number>();
    if (productIds.length > 0) {
      const invRows = await this.db
        .select({
          productId: inventoryLevels.productId,
          quantityOnHand: inventoryLevels.quantityOnHand,
        })
        .from(inventoryLevels)
        .where(inArray(inventoryLevels.productId, productIds));

      for (const row of invRows) {
        if (row.productId) {
          onHandMap.set(row.productId, parseFloat(row.quantityOnHand ?? '0'));
        }
      }
    }

    // 4. Final computation
    const pickingLines: PickingLine[] = [];
    const backOrderLines: BackOrderLine[] = [];

    for (const line of lines) {
      const ordered = parseFloat(line.quantity);
      const picked = pickedMap.get(line.lineId) ?? 0;
      const toPick = ordered - picked;
      const CUSTOM_LINE_ID = '00000000-0000-0000-0000-000000000000';
      const isCustomLine = line.productId === CUSTOM_LINE_ID;
      const productCode = isCustomLine
        ? ''
        : line.productNumber || line.productId || '';
      const description = line.productDescription || '';

      if (toPick > 0) {
        pickingLines.push({
          productCode,
          description,
          binNumber: binMap.get(line.productId!) ?? '—',
          qtyToPick: toPick,
        });
      }

      const onHand = onHandMap.get(line.productId!) ?? 0;
      if (ordered > onHand) {
        backOrderLines.push({
          productCode,
          description,
          qtyToOrder: ordered - onHand,
        });
      }
    }

    return {
      header: {
        orderNumber: header.orderNumber ?? '',
        customerName: header.customerName ?? '',
        customerOrderNumber: header.customerOrderNumber ?? '',
        orderDate: header.createdOn
          ? new Date(header.createdOn).toLocaleDateString('en-IE')
          : '',
        locationName: header.locationName ?? '',
      },
      pickingLines,
      backOrderLines,
      generatedAt:
        new Date().toLocaleDateString('en-IE') +
        ' ' +
        new Date().toLocaleTimeString('en-IE', {
          hour: '2-digit',
          minute: '2-digit',
        }),
    };
  }
}
