import {
  Injectable,
  Inject,
  BadRequestException,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderLineItems,
} from '../drizzle/modbm-core-schema';
import {
  findOrder,
  findOrderLine,
  getShippedPerLine,
  writeEvent,
} from './shipment-helpers';
import { ShipmentService } from './shipment.service';

@Injectable()
export class PickingService {
  constructor(
    @Inject(DRIZZLE) private db: any,
    private readonly shipmentService: ShipmentService,
  ) { }

  private get database(): DrizzleDB {
    return this.db as DrizzleDB;
  }

  // -------------------------------------------------------------------------
  // Picking operations
  // -------------------------------------------------------------------------

  /**
   * Set the picked quantity for a single order line.
   */
  async pickLine(
    orderId: string,
    lineId: string,
    quantityPicked: string,
    actor: string,
  ) {
    const order = await findOrder(this.database, orderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot pick lines on order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    const line = await findOrderLine(this.database, lineId, orderId);
    const qty = parseFloat(quantityPicked);
    const ordered = parseFloat(line.quantity);

    if (isNaN(qty) || qty < 0) {
      throw new BadRequestException('Picked quantity must be >= 0');
    }
    if (qty > ordered) {
      throw new BadRequestException(
        `Cannot pick ${qty} — only ${ordered} ordered on this line`,
      );
    }

    // Ensure picked qty doesn't drop below what's already been shipped
    const shippedMap = await getShippedPerLine(this.database, orderId);
    const shipped = shippedMap.get(lineId) || 0;
    if (qty < shipped) {
      throw new BadRequestException(
        `Cannot reduce picked to ${qty} — ${shipped} already shipped on this line`,
      );
    }

    const result = await this.database.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({ quantityPicked })
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await writeEvent(tx, orderId, 'picking_line_updated', {
        lineId,
        quantityPicked,
        previousQuantityPicked: line.quantityPicked,
      }, actor);

      return updated;
    });

    return result;
  }

  /**
   * Pick all for a single line: set quantity_picked = quantity.
   */
  async pickAllForLine(orderId: string, lineId: string, actor: string) {
    const order = await findOrder(this.database, orderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot pick lines on order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    const line = await findOrderLine(this.database, lineId, orderId);

    const result = await this.database.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({ quantityPicked: line.quantity })
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await writeEvent(tx, orderId, 'picking_line_picked_all', {
        lineId,
        quantityPicked: line.quantity,
        previousQuantityPicked: line.quantityPicked,
      }, actor);

      return updated;
    });

    return result;
  }

  /**
   * Pick all for the entire order: set all quantity_picked = quantity
   * AND create a shipment with the UNSHIPPED quantities.
   */
  async pickAllOrder(orderId: string, actor: string) {
    const order = await findOrder(this.database, orderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot pick on order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    const lines = await this.database
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    if (lines.length === 0) {
      throw new BadRequestException('Order has no lines to pick');
    }

    // First, set all lines as fully picked
    await this.database.transaction(async (tx: any) => {
      for (const line of lines) {
        await tx
          .update(salesOrderLineItems)
          .set({ quantityPicked: line.quantity })
          .where(eq(salesOrderLineItems.salesOrderLineId, line.salesOrderLineId));
      }

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await writeEvent(tx, orderId, 'picking_order_picked_all', {
        lineCount: lines.length,
      }, actor);
    });

    // Now create the shipment with unshipped quantities, using the ShipmentService
    // (which will re-read the picked state and compute availability correctly)
    const shippedMap = await getShippedPerLine(this.database, orderId);
    const shipmentLines = lines
      .map((line) => {
        const alreadyShipped = shippedMap.get(line.salesOrderLineId) ?? 0;
        const toShip = parseFloat(line.quantity) - alreadyShipped;
        if (toShip <= 0) return null;
        return {
          salesOrderLineId: line.salesOrderLineId,
          quantityShipped: String(toShip),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (shipmentLines.length > 0) {
      return this.shipmentService.createShipment(orderId, { lines: shipmentLines }, actor);
    }

    // Everything was already shipped — return a marker
    return { message: 'All lines already shipped; no new shipment created.' };
  }

  // -------------------------------------------------------------------------
  // Summary
  // -------------------------------------------------------------------------

  /**
   * Get picking summary for an order, including shipped quantities.
   */
  async getPickingSummary(orderId: string) {
    await findOrder(this.database, orderId);

    const lines = await this.database
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    const shippedMap = await getShippedPerLine(this.database, orderId);

    const summary = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const picked = parseFloat(line.quantityPicked ?? '0');
      const shipped = shippedMap.get(line.salesOrderLineId) ?? 0;
      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productDescription: line.productDescription,
        quantity: line.quantity,
        quantityPicked: line.quantityPicked ?? '0',
        quantityShipped: String(shipped),
        remaining: String(ordered - picked),
        isFullyPicked: picked >= ordered,
      };
    });

    const totalLines = lines.length;
    const fullyPickedLines = summary.filter((s) => s.isFullyPicked).length;

    return {
      totalLines,
      fullyPickedLines,
      isFullyPicked: totalLines > 0 && fullyPickedLines === totalLines,
      lines: summary,
    };
  }

  // -------------------------------------------------------------------------
  // Shipped gate — called from OrdersWriteService
  // -------------------------------------------------------------------------

  /**
   * Check if all lines on an order are fully picked.
   * Throws BadRequestException if not.
   */
  async assertFullyPicked(orderId: string): Promise<void> {
    const lines = await this.database
      .select({
        lineNumber: salesOrderLineItems.lineNumber,
        quantity: salesOrderLineItems.quantity,
        quantityPicked: salesOrderLineItems.quantityPicked,
      })
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId));

    const unpicked = lines.filter((l) => {
      const ordered = parseFloat(l.quantity);
      const picked = parseFloat(l.quantityPicked ?? '0');
      return picked < ordered;
    });

    if (unpicked.length > 0) {
      const details = unpicked.map(
        (l) => `line ${l.lineNumber}: picked ${l.quantityPicked ?? '0'} of ${l.quantity}`,
      );
      throw new BadRequestException(
        `Cannot transition to 'shipped' — ${unpicked.length} line(s) not fully picked: ${details.join('; ')}`,
      );
    }
  }
}
