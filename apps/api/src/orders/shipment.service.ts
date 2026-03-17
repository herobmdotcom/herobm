import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq, sql, desc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesOrderLineItems,
} from '../drizzle/modbm-core-schema';
import { products as martProducts } from '../drizzle/schema';
import {
  findOrder,
  findOrderLine,
  findShipment,
  findShipmentLine,
  assertShipmentQtyAvailable,
  writeEvent,
} from './shipment-helpers';
import { evaluateLifecycleRules } from './order-lifecycle-rules';
import { InventoryService } from '../inventory/inventory.service';

// ============================================================================
// Shipment state machine
// ============================================================================

const SHIPMENT_STATE_TRANSITIONS: Record<string, string[]> = {
  draft: ['dispatched', 'cancelled'],
  dispatched: ['draft'], // cannot transition directly from dispatched to cancelled
  cancelled: [],
};

const VALID_SHIPMENT_STATES = Object.keys(SHIPMENT_STATE_TRANSITIONS);

// ============================================================================
// DTOs
// ============================================================================

interface CreateShipmentDto {
  notes?: string;
  trackingNumber?: string;
  lines: Array<{
    salesOrderLineId: string;
    quantityShipped: string;
  }>;
}

interface UpdateShipmentDto {
  notes?: string;
  trackingNumber?: string;
}

interface AddShipmentLineDto {
  salesOrderLineId: string;
  quantityShipped: string;
}

interface UpdateShipmentLineDto {
  quantityShipped?: string;
}

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ShipmentService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly inventoryService: InventoryService,
  ) {}

  private readonly logger = new Logger(ShipmentService.name);

  // -------------------------------------------------------------------------
  // Number generation
  // -------------------------------------------------------------------------

  async generateShipmentNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SHP-${today}-`;

    const result = await this.db
      .select({ shipmentNumber: salesOrderShipments.shipmentNumber })
      .from(salesOrderShipments)
      .where(sql`${salesOrderShipments.shipmentNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesOrderShipments.shipmentNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].shipmentNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // -------------------------------------------------------------------------
  // CRUD
  // -------------------------------------------------------------------------

  /**
   * Create a new shipment against an order in picking state.
   */
  async createShipment(
    salesOrderId: string,
    dto: CreateShipmentDto,
    actor: string,
  ) {
    const order = await findOrder(this.db, salesOrderId);
    if (order.stateCode !== 'picking') {
      throw new BadRequestException(
        `Cannot create shipment for order in state '${order.stateCode}'. Order must be in 'picking'.`,
      );
    }

    // Validate every line: shipped qty must be available
    for (const line of dto.lines) {
      const orderLine = await findOrderLine(
        this.db,
        line.salesOrderLineId,
        salesOrderId,
      );
      await assertShipmentQtyAvailable(
        this.db,
        salesOrderId,
        line.salesOrderLineId,
        parseFloat(line.quantityShipped),
        orderLine.lineNumber,
      );
    }

    const shipmentNumber = await this.generateShipmentNumber();

    const result = await this.db.transaction(async (tx: any) => {
      const [shipment] = await tx
        .insert(salesOrderShipments)
        .values({
          shipmentNumber,
          salesOrderId,
          stateCode: 'draft',
          notes: dto.notes,
          trackingNumber: dto.trackingNumber,
          createdBy: actor,
        })
        .returning();

      const lineValues = dto.lines.map((line) => ({
        shipmentId: shipment.shipmentId,
        salesOrderLineId: line.salesOrderLineId,
        quantityShipped: line.quantityShipped,
      }));

      if (lineValues.length > 0) {
        await tx.insert(salesOrderShipmentLines).values(lineValues);
      }

      await writeEvent(
        tx,
        salesOrderId,
        'shipment_created',
        {
          shipmentId: shipment.shipmentId,
          shipmentNumber,
          lineCount: lineValues.length,
        },
        actor,
        'sales_order_shipment',
      );

      return shipment;
    });

    this.logger.log(
      `Shipment created: ${shipmentNumber} for order ${salesOrderId} with ${dto.lines.length} lines by ${actor}`,
    );
    return result;
  }

  /**
   * Update shipment header (notes, tracking). Editable in any non-cancelled state.
   */
  async updateShipment(
    shipmentId: string,
    dto: UpdateShipmentDto,
    actor: string,
  ) {
    const shipment = await findShipment(this.db, shipmentId);

    if (shipment.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot update a ${shipment.stateCode} shipment.`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrderShipments)
        .set({
          ...(dto.notes !== undefined && { notes: dto.notes }),
          ...(dto.trackingNumber !== undefined && {
            trackingNumber: dto.trackingNumber,
          }),
          modifiedOn: new Date(),
        })
        .where(eq(salesOrderShipments.shipmentId, shipmentId))
        .returning();

      await writeEvent(
        tx,
        shipment.salesOrderId,
        'shipment_updated',
        {
          shipmentId,
          changes: dto,
        },
        actor,
        'sales_order_shipment',
      );

      return updated;
    });

    return result;
  }

  /**
   * Transition shipment state.
   */
  async changeShipmentState(
    shipmentId: string,
    newState: string,
    actor: string,
  ) {
    if (!VALID_SHIPMENT_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid shipment state: '${newState}'`);
    }

    const shipment = await findShipment(this.db, shipmentId);
    const allowed = SHIPMENT_STATE_TRANSITIONS[shipment.stateCode];

    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition shipment from '${shipment.stateCode}' to '${newState}'. ` +
          `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrderShipments)
        .set({ stateCode: newState, modifiedOn: new Date() })
        .where(eq(salesOrderShipments.shipmentId, shipmentId))
        .returning();

      // ── Inventory hooks ──
      // Fetch shipment lines to get quantities
      const shipmentLines = await tx
        .select()
        .from(salesOrderShipmentLines)
        .where(eq(salesOrderShipmentLines.shipmentId, shipmentId));

      // Resolve productIds from order lines
      const stockLines = [];
      for (const sl of shipmentLines) {
        const orderLine = await findOrderLine(
          tx,
          sl.salesOrderLineId,
          shipment.salesOrderId,
        );
        stockLines.push({
          productId: orderLine.productId,
          quantity: sl.quantityShipped,
        });
      }

      if (shipment.stateCode === 'draft' && newState === 'dispatched') {
        // Dispatching: deduct on-hand, release committed
        await this.inventoryService.deductStock(tx, stockLines);
      } else if (
        shipment.stateCode === 'dispatched' &&
        (newState === 'draft' || newState === 'cancelled')
      ) {
        // Reversing or cancelling a dispatch: restore on-hand and re-commit
        await this.inventoryService.restoreStock(tx, stockLines);
      }

      const eventType =
        newState === 'dispatched'
          ? 'shipment_dispatched'
          : 'shipment_status_changed';

      await writeEvent(
        tx,
        shipment.salesOrderId,
        eventType,
        {
          shipmentId,
          shipmentNumber: shipment.shipmentNumber,
          from: shipment.stateCode,
          to: newState,
        },
        actor,
        'sales_order_shipment',
      );

      const autoTransitions = await evaluateLifecycleRules(
        tx,
        shipment.salesOrderId,
        { entity: 'shipment', id: shipmentId, action: newState },
        actor,
      );

      return { ...updated, _autoTransitions: autoTransitions };
    });

    this.logger.log(
      `Shipment ${shipment.shipmentNumber} state: ${shipment.stateCode} → ${newState} by ${actor}`,
    );
    return result;
  }

  /**
   * Add a line to a draft shipment.
   */
  async addShipmentLine(
    shipmentId: string,
    dto: AddShipmentLineDto,
    actor: string,
  ) {
    const shipment = await findShipment(this.db, shipmentId);

    if (shipment.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot add lines to shipment in state '${shipment.stateCode}'`,
      );
    }

    const orderLine = await findOrderLine(
      this.db,
      dto.salesOrderLineId,
      shipment.salesOrderId,
    );
    await assertShipmentQtyAvailable(
      this.db,
      shipment.salesOrderId,
      dto.salesOrderLineId,
      parseFloat(dto.quantityShipped),
      orderLine.lineNumber,
    );

    const result = await this.db.transaction(async (tx: any) => {
      const [line] = await tx
        .insert(salesOrderShipmentLines)
        .values({
          shipmentId,
          salesOrderLineId: dto.salesOrderLineId,
          quantityShipped: dto.quantityShipped,
        })
        .returning();

      await tx
        .update(salesOrderShipments)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderShipments.shipmentId, shipmentId));

      await writeEvent(
        tx,
        shipment.salesOrderId,
        'shipment_line_added',
        {
          shipmentId,
          shipmentLineId: line.shipmentLineId,
          salesOrderLineId: dto.salesOrderLineId,
          quantityShipped: dto.quantityShipped,
        },
        actor,
        'sales_order_shipment',
      );

      return line;
    });

    return result;
  }

  /**
   * Update a shipment line (quantity).
   */
  async updateShipmentLine(
    shipmentId: string,
    lineId: string,
    dto: UpdateShipmentLineDto,
    actor: string,
  ) {
    const shipment = await findShipment(this.db, shipmentId);

    if (shipment.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot update lines on shipment in state '${shipment.stateCode}'`,
      );
    }

    const existingLine = await findShipmentLine(this.db, lineId, shipmentId);

    if (dto.quantityShipped !== undefined) {
      const orderLine = await findOrderLine(
        this.db,
        existingLine.salesOrderLineId,
        shipment.salesOrderId,
      );
      await assertShipmentQtyAvailable(
        this.db,
        shipment.salesOrderId,
        existingLine.salesOrderLineId,
        parseFloat(dto.quantityShipped),
        orderLine.lineNumber,
        lineId, // exclude this line's current qty from the total
      );
    }

    const result = await this.db.transaction(async (tx: any) => {
      const [updated] = await tx
        .update(salesOrderShipmentLines)
        .set({
          ...(dto.quantityShipped !== undefined && {
            quantityShipped: dto.quantityShipped,
          }),
        })
        .where(eq(salesOrderShipmentLines.shipmentLineId, lineId))
        .returning();

      await tx
        .update(salesOrderShipments)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderShipments.shipmentId, shipmentId));

      await writeEvent(
        tx,
        shipment.salesOrderId,
        'shipment_line_updated',
        {
          shipmentId,
          shipmentLineId: lineId,
          changes: dto,
          previousValues: {
            quantityShipped: existingLine.quantityShipped,
          },
        },
        actor,
        'sales_order_shipment',
      );

      return updated;
    });

    return result;
  }

  /**
   * Remove a shipment line.
   */
  async removeShipmentLine(shipmentId: string, lineId: string, actor: string) {
    const shipment = await findShipment(this.db, shipmentId);

    if (shipment.stateCode !== 'draft') {
      throw new BadRequestException(
        `Cannot remove lines from shipment in state '${shipment.stateCode}'`,
      );
    }

    const existingLine = await findShipmentLine(this.db, lineId, shipmentId);

    await this.db.transaction(async (tx: any) => {
      await tx
        .delete(salesOrderShipmentLines)
        .where(eq(salesOrderShipmentLines.shipmentLineId, lineId));

      await tx
        .update(salesOrderShipments)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderShipments.shipmentId, shipmentId));

      await writeEvent(
        tx,
        shipment.salesOrderId,
        'shipment_line_removed',
        {
          shipmentId,
          shipmentLineId: lineId,
          salesOrderLineId: existingLine.salesOrderLineId,
          quantityShipped: existingLine.quantityShipped,
        },
        actor,
        'sales_order_shipment',
      );
    });
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  async findOne(shipmentId: string) {
    const shipment = await findShipment(this.db, shipmentId);

    const lines = await this.db
      .select({
        shipmentLineId: salesOrderShipmentLines.shipmentLineId,
        salesOrderLineId: salesOrderShipmentLines.salesOrderLineId,
        quantityShipped: salesOrderShipmentLines.quantityShipped,
        productId: salesOrderLineItems.productId,
        productNumber: martProducts.productNumber,
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesOrderShipmentLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .leftJoin(
        martProducts,
        eq(salesOrderLineItems.productId, martProducts.productId),
      )
      .where(eq(salesOrderShipmentLines.shipmentId, shipmentId));

    return { ...shipment, lines };
  }

  async findByOrder(salesOrderId: string) {
    const shipments = await this.db
      .select()
      .from(salesOrderShipments)
      .where(eq(salesOrderShipments.salesOrderId, salesOrderId))
      .orderBy(desc(salesOrderShipments.createdOn));

    const result = [];
    for (const shipment of shipments) {
      const lines = await this.db
        .select({
          shipmentLineId: salesOrderShipmentLines.shipmentLineId,
          salesOrderLineId: salesOrderShipmentLines.salesOrderLineId,
          quantityShipped: salesOrderShipmentLines.quantityShipped,
          productId: salesOrderLineItems.productId,
          productNumber: martProducts.productNumber,
        })
        .from(salesOrderShipmentLines)
        .innerJoin(
          salesOrderLineItems,
          eq(
            salesOrderShipmentLines.salesOrderLineId,
            salesOrderLineItems.salesOrderLineId,
          ),
        )
        .leftJoin(
          martProducts,
          eq(salesOrderLineItems.productId, martProducts.productId),
        )
        .where(eq(salesOrderShipmentLines.shipmentId, shipment.shipmentId));
      result.push({ ...shipment, lines });
    }

    return result;
  }
}
