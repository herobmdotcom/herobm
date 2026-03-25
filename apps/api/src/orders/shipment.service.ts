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
  products as coreProducts,
  outbox,
  bins,
} from '../drizzle/modbm-core-schema';
import { ConfigService } from '@nestjs/config';
import { getValuationStrategy } from '../inventory/valuation';
import {
  findOrder,
  findOrderLine,
  findShipment,
  findShipmentLine,
  assertShipmentQtyAvailable,
  writeEvent,
  getInvoicedPerLine,
  getCommittedPerLine,
} from './shipment-helpers';
import { evaluateLifecycleRules } from './order-lifecycle-rules';
import { InventoryService } from '../inventory/inventory.service';

import {
  SHIPMENT_TRANSITIONS as SHIPMENT_STATE_TRANSITIONS,
  getValidStates,
} from '@modbm/shared';

const VALID_SHIPMENT_STATES = getValidStates(SHIPMENT_STATE_TRANSITIONS);

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
    private configService: ConfigService,
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

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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
        const method = this.configService.get<string>(
          'INVENTORY_VALUATION_METHOD',
        );
        const strategy = getValuationStrategy(method);

        const [shippingBin] = await tx
          .select({ binId: bins.binId, locationNo: bins.locationNo })
          .from(bins)
          .where(eq(bins.binNumber, 'SHIPPING'))
          .limit(1);

        if (!shippingBin) {
          throw new BadRequestException('System SHIPPING bin is missing.');
        }

        const dispatchLines = stockLines.map((line) => ({
          productId: line.productId!,
          binId: shippingBin.binId,
          locationNo: shippingBin.locationNo,
          quantity: -parseFloat(line.quantity),
        }));

        if (dispatchLines.length > 0) {
          await this.inventoryService.recordInventoryMovement(tx, {
            entryNumber:
              'DSP-' +
              shipment.shipmentNumber +
              '-' +
              Date.now().toString().slice(-4),
            sourceType: 'SO_SHIPMENT',
            sourceId: shipmentId,
            memo: 'Goods Dispatched',
            userId: actor,
            lines: dispatchLines,
          });
        }

        // Calculate COGS and record outbox event for GL mapping
        const cogsDetails = [];
        for (const line of stockLines) {
          if (!line.productId) continue;

          const isUuid =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              line.productId,
            );

          const [product] = await tx
            .select()
            .from(coreProducts)
            .where(
              isUuid
                ? eq(coreProducts.productId, line.productId)
                : eq(coreProducts.productNumber, line.productId),
            );

          if (product) {
            const cogsAmount = strategy.getCogs(
              {
                productId: product.productId,
                standardCost: product.standardCost || '0',
                weightedAverageCost: product.weightedAverageCost || '0',
                quantityOnHand: product.quantityOnHand || '0',
              },
              parseFloat(line.quantity),
            );

            cogsDetails.push({
              productId: line.productId,
              quantity: line.quantity,
              cogsAmount,
            });
          }
        }

        await tx.insert(outbox).values({
          aggregateType: 'sales_order_shipment',
          aggregateId: shipmentId,
          eventType: 'goods_dispatched',
          payload: {
            shipmentId,
            shipmentNumber: shipment.shipmentNumber,
            salesOrderId: shipment.salesOrderId,
            cogsDetails,
          },
        });
      } else if (
        shipment.stateCode === 'dispatched' &&
        (newState === 'draft' || newState === 'cancelled')
      ) {
        // [GUARD]: Check if reverting drops shipped below invoiced
        const invoicedMap = await getInvoicedPerLine(tx, shipment.salesOrderId);
        const shippedMap = await getCommittedPerLine(tx, shipment.salesOrderId);

        for (const line of shipmentLines) {
          const invoiced = invoicedMap.get(line.salesOrderLineId) || 0;
          const currentlyShipped = shippedMap.get(line.salesOrderLineId) || 0;
          const newShipped =
            currentlyShipped - parseFloat(line.quantityShipped);

          if (invoiced > newShipped) {
            const orderLine = await findOrderLine(
              tx,
              line.salesOrderLineId,
              shipment.salesOrderId,
            );
            throw new BadRequestException(
              `Cannot transition shipment: reverting line ${orderLine.lineNumber} drops shipped quantity (${newShipped}) below already invoiced quantity (${invoiced}). Please reverse the invoice via a Credit Note first.`,
            );
          }
        }

        const [shippingBin] = await tx
          .select({ binId: bins.binId, locationNo: bins.locationNo })
          .from(bins)
          .where(eq(bins.binNumber, 'SHIPPING'))
          .limit(1);

        if (!shippingBin) {
          throw new BadRequestException('System SHIPPING bin is missing.');
        }

        const returnLines = stockLines.map((line) => ({
          productId: line.productId!,
          binId: shippingBin.binId,
          locationNo: shippingBin.locationNo,
          quantity: parseFloat(line.quantity),
        }));

        if (returnLines.length > 0) {
          await this.inventoryService.recordInventoryMovement(tx, {
            entryNumber:
              'REV-' +
              shipment.shipmentNumber +
              '-' +
              Date.now().toString().slice(-4),
            sourceType: 'SO_SHIPMENT',
            sourceId: shipmentId,
            memo: 'Dispatch Reversed',
            userId: actor,
            lines: returnLines,
          });
        }

        // Record reversal outbox event to mathematically restore COGS dynamically
        await tx.insert(outbox).values({
          aggregateType: 'sales_order_shipment',
          aggregateId: shipmentId,
          eventType: 'goods_dispatch_reverted',
          payload: {
            shipmentId,
            shipmentNumber: shipment.shipmentNumber,
            salesOrderId: shipment.salesOrderId,
          },
        });
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

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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

    const result = await this.db.transaction(async (tx: DrizzleDB) => {
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

    await this.db.transaction(async (tx: DrizzleDB) => {
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
        productNumber: coreProducts.productNumber,
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
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
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
          productNumber: coreProducts.productNumber,
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
          coreProducts,
          eq(salesOrderLineItems.productId, coreProducts.productId),
        )
        .where(eq(salesOrderShipmentLines.shipmentId, shipment.shipmentId));
      result.push({ ...shipment, lines });
    }

    return result;
  }
}
