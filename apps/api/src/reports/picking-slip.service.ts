import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, inArray, sql } from 'drizzle-orm';
import { join } from 'path';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
  inventoryLevels,
  accounts as coreAccounts,
  salesOrderPicks,
  binContents,
  bins,
  zones,
  locations,
} from '../drizzle/modbm-core-schema';

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

@Injectable()
export class PickingSlipService {
  constructor(@Inject(DRIZZLE) private db: DrizzleDB) {}

  private readonly logger = new Logger(PickingSlipService.name);

  /**
   * Query all required data for the picking slip.
   * Exported for testability.
   */
  async assembleData(orderId: string): Promise<PickingSlipData> {
    // 1. Order header + customer name
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
        eq(salesOrders.customerId, coreAccounts.accountId),
      )
      .leftJoin(
        locations,
        eq(salesOrders.fulfillmentLocationId, locations.locationId),
      )
      .where(eq(salesOrders.salesOrderId, orderId))
      .limit(1);

    if (orderRows.length === 0) {
      throw new NotFoundException(`Order '${orderId}' not found`);
    }
    const order = orderRows[0];

    // 2. Order lines with product numbers
    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        quantityPicked: salesOrderLineItems.quantityPicked,
        lineNumber: salesOrderLineItems.lineNumber,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    if (lines.length === 0) {
      throw new NotFoundException(`Order '${orderId}' has no lines`);
    }

    // 3. Bin numbers from modbm_core (keyed by productId)
    // Removed because defaultBinNumber was dropped during the ABM to Core inventory_levels migration.
    const productIds = lines
      .map((l) => l.productId)
      .filter((id): id is string => id !== null && id !== undefined);

    const lineIds = lines.map((l) => l.salesOrderLineId);

    const binMap = new Map<string, string>();
    if (productIds.length > 0) {
      // Find a valid bin for each product
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

    // 4. Get accurate picked quantities from the picks subledger
    const pickedMap = new Map<string, number>();
    if (lineIds.length > 0) {
      const picks = await this.db
        .select({
          salesOrderLineId: salesOrderPicks.salesOrderLineId,
          quantity: salesOrderPicks.quantity,
        })
        .from(salesOrderPicks)
        .where(
          and(
            inArray(salesOrderPicks.salesOrderLineId, lineIds),
            sql`${salesOrderPicks.stateCode} != 'cancelled'`,
          ),
        );

      for (const p of picks) {
        pickedMap.set(
          p.salesOrderLineId,
          (pickedMap.get(p.salesOrderLineId) || 0) + parseFloat(p.quantity),
        );
      }
    }

    // 5. Get on-hand quantities from inventoryLevels for back-order logic
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

    // 6. Compute picking lines and back-order lines
    const pickingLines: PickingLine[] = [];
    const backOrderLines: BackOrderLine[] = [];

    for (const line of lines) {
      const ordered = parseFloat(line.quantity);
      const picked = pickedMap.get(line.salesOrderLineId) ?? 0;
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

      // Back-order: ordered qty exceeds on-hand stock
      const onHand = onHandMap.get(line.productId!) ?? 0;
      if (ordered > onHand) {
        const qtyToOrder = ordered - onHand;
        backOrderLines.push({
          productCode,
          description,
          qtyToOrder,
        });
      }
    }

    const header: PickingSlipHeader = {
      orderNumber: order.orderNumber ?? '',
      customerName: order.customerName ?? '',
      customerOrderNumber: order.customerOrderNumber ?? '',
      orderDate: order.createdOn
        ? new Date(order.createdOn).toLocaleDateString('en-IE')
        : '',
      locationName: order.locationName ?? '',
    };

    return {
      header,
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
