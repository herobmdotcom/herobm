import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq, and, inArray } from 'drizzle-orm';
import { join } from 'path';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
  products as coreProducts,
} from '../drizzle/modbm-core-schema';
import { accounts, inventory, productSuppliers } from '../drizzle/schema';

// ─── Data shapes ────────────────────────────────────────────────────────────

export interface PickingSlipHeader {
  orderNumber: string;
  customerName: string;
  customerOrderNumber: string;
  orderDate: string;
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
  supplierName: string;
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
        customerName: accounts.name,
        customerOrderNumber: salesOrders.customerOrderNumber,
        createdOn: salesOrders.createdOn,
      })
      .from(salesOrders)
      .leftJoin(accounts, eq(salesOrders.customerId, accounts.accountId))
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

    // 3. Bin numbers from mart_inventory (keyed by productId)
    const productIds = lines
      .map((l) => l.productId)
      .filter((id): id is string => id !== null && id !== undefined);

    const binMap = new Map<string, string>();
    if (productIds.length > 0) {
      const invRows = await this.db
        .select({
          productId: inventory.productId,
          defaultBinNumber: inventory.defaultBinNumber,
        })
        .from(inventory)
        .where(inArray(inventory.productId, productIds));

      for (const row of invRows) {
        if (row.productId && row.defaultBinNumber) {
          binMap.set(row.productId, row.defaultBinNumber);
        }
      }
    }

    // 4. Supplier names from mart_product_suppliers (preferred supplier)
    const supplierMap = new Map<string, string>();
    if (productIds.length > 0) {
      const suppRows = await this.db
        .select({
          productId: productSuppliers.productId,
          vendorName: productSuppliers.vendorName,
          isPreferred: productSuppliers.isPreferred,
        })
        .from(productSuppliers)
        .where(
          and(
            inArray(productSuppliers.productId, productIds),
            eq(productSuppliers.isPreferred, true),
          ),
        );

      for (const row of suppRows) {
        if (row.productId && row.vendorName) {
          supplierMap.set(row.productId, row.vendorName);
        }
      }
    }

    // 5. Get on-hand quantities from mart_inventory for back-order logic
    const onHandMap = new Map<string, number>();
    if (productIds.length > 0) {
      const invRows = await this.db
        .select({
          productId: inventory.productId,
          quantityOnHand: inventory.quantityOnHand,
        })
        .from(inventory)
        .where(inArray(inventory.productId, productIds));

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
      const picked = parseFloat(line.quantityPicked ?? '0');
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
          binNumber: binMap.get(productCode) ?? '—',
          qtyToPick: toPick,
        });
      }

      // Back-order: ordered qty exceeds on-hand stock
      const onHand = onHandMap.get(productCode) ?? 0;
      if (ordered > onHand) {
        const qtyToOrder = ordered - onHand;
        backOrderLines.push({
          productCode,
          description,
          supplierName: supplierMap.get(productCode) ?? '—',
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
