import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { salesOrders, salesOrderLineItems } from '../drizzle/modbm-core-schema';
import { products as martProducts } from '../drizzle/schema';
import {
  findOrder,
  findOrderLine,
  getCommittedPerLine,
  writeEvent,
} from './shipment-helpers';
import { ShipmentService } from './shipment.service';

@Injectable()
export class PickingService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly shipmentService: ShipmentService,
  ) {}

  private readonly logger = new Logger(PickingService.name);

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
    const order = await findOrder(this.db, orderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot pick lines on order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    const line = await findOrderLine(this.db, lineId, orderId);
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
    const committedMap = await getCommittedPerLine(this.db, orderId);
    const committed = committedMap.get(lineId) || 0;
    if (qty < committed) {
      throw new BadRequestException(
        `Cannot reduce picked to ${qty} — ${committed} already committed to shipments on this line`,
      );
    }

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({ quantityPicked })
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await writeEvent(
        tx,
        orderId,
        'picking_line_updated',
        {
          lineId,
          quantityPicked,
          previousQuantityPicked: line.quantityPicked,
        },
        actor,
      );

      return updated;
    });

    return result;
  }

  /**
   * Pick all for a single line: set quantity_picked = quantity.
   */
  async pickAllForLine(orderId: string, lineId: string, actor: string) {
    const order = await findOrder(this.db, orderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot pick lines on order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    const line = await findOrderLine(this.db, lineId, orderId);

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
      const [updated] = await tx
        .update(salesOrderLineItems)
        .set({ quantityPicked: line.quantity })
        .where(eq(salesOrderLineItems.salesOrderLineId, lineId))
        .returning();

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await writeEvent(
        tx,
        orderId,
        'picking_line_picked_all',
        {
          lineId,
          quantityPicked: line.quantity,
          previousQuantityPicked: line.quantityPicked,
        },
        actor,
      );

      return updated;
    });

    return result;
  }

  /**
   * Pick all for the entire order: set all quantity_picked = quantity
   * AND create a shipment with the UNSHIPPED quantities.
   */
  async pickAllOrder(orderId: string, actor: string) {
    const order = await findOrder(this.db, orderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot pick on order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    const lines = await this.db
      .select()
      .from(salesOrderLineItems)
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    if (lines.length === 0) {
      throw new BadRequestException('Order has no lines to pick');
    }

    // First, set all lines as fully picked
    await this.db.transaction(async (tx: DrizzleDB) => {
      for (const line of lines) {
        await tx
          .update(salesOrderLineItems)
          .set({ quantityPicked: line.quantity })
          .where(
            eq(salesOrderLineItems.salesOrderLineId, line.salesOrderLineId),
          );
      }

      await tx
        .update(salesOrders)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrders.salesOrderId, orderId));

      await writeEvent(
        tx,
        orderId,
        'picking_order_picked_all',
        {
          lineCount: lines.length,
        },
        actor,
      );
    });

    // Now create the shipment with unshipped quantities, using the ShipmentService
    // (which will re-read the picked state and compute availability correctly)
    const committedMap = await getCommittedPerLine(this.db, orderId);
    const shipmentLines = lines
      .map((line) => {
        const alreadyCommitted = committedMap.get(line.salesOrderLineId) ?? 0;
        const toShip = parseFloat(line.quantity) - alreadyCommitted;
        if (toShip <= 0) return null;
        return {
          salesOrderLineId: line.salesOrderLineId,
          quantityShipped: String(toShip),
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (shipmentLines.length > 0) {
      return this.shipmentService.createShipment(
        orderId,
        { lines: shipmentLines },
        actor,
      );
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
    await findOrder(this.db, orderId);

    const lines = await this.db
      .select({
        salesOrderLineId: salesOrderLineItems.salesOrderLineId,
        lineNumber: salesOrderLineItems.lineNumber,
        productId: salesOrderLineItems.productId,
        productDescription: salesOrderLineItems.productDescription,
        quantity: salesOrderLineItems.quantity,
        quantityPicked: salesOrderLineItems.quantityPicked,
        productNumber: martProducts.productNumber,
      })
      .from(salesOrderLineItems)
      .leftJoin(
        martProducts,
        eq(salesOrderLineItems.productId, martProducts.productId),
      )
      .where(eq(salesOrderLineItems.salesOrderId, orderId))
      .orderBy(salesOrderLineItems.lineNumber);

    const committedMap = await getCommittedPerLine(this.db, orderId);

    const summary = lines.map((line) => {
      const ordered = parseFloat(line.quantity);
      const picked = parseFloat(line.quantityPicked ?? '0');
      const committed = committedMap.get(line.salesOrderLineId) ?? 0;
      return {
        salesOrderLineId: line.salesOrderLineId,
        lineNumber: line.lineNumber,
        productId: line.productId,
        productNumber: line.productNumber,
        productDescription: line.productDescription,
        quantity: line.quantity,
        quantityPicked: line.quantityPicked ?? '0',
        quantityShipped: String(committed),
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
    const lines = await this.db
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
        (l) =>
          `line ${l.lineNumber}: picked ${l.quantityPicked ?? '0'} of ${l.quantity}`,
      );
      throw new BadRequestException(
        `Cannot transition to 'shipped' — ${unpicked.length} line(s) not fully picked: ${details.join('; ')}`,
      );
    }
  }

  /**
   * Check if all lines on an order are fully shipped.
   * Throws BadRequestException if not.
   */
  async assertFullyShipped(orderId: string): Promise<void> {
    const summary = await this.getPickingSummary(orderId);

    const unshipped = summary.lines.filter((l) => {
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
        `Cannot transition to 'shipped' — ${unshipped.length} line(s) not fully shipped: ${details.join('; ')}`,
      );
    }
  }
}
