import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, desc, and, gte, or } from 'drizzle-orm';
import { DRIZZLE } from '../../drizzle/drizzle.module';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import {
  salesOrders,
  salesOrderShipments,
  salesOrderShipmentLines,
  salesOrderLineItems,
  products as coreProducts,
  bins,
  inventoryEntries,
  inventoryLedger,
  customers as coreAccounts,
  customerGroups,
  backorders,
  purchaseOrders,
  systemEvents,
  warehouseEvents,
  salesOrderPicks,
  transferOrders,
  transferOrderShipments,
  transferOrderShipmentLines,
  transferOrderLines,
  locations,
  actors,
} from '@herobm/db-schema';
import { AppConfigService } from '../../settings/app-config.service';
import { getValuationStrategy } from '../../inventory/valuation';
import { getAccountingStrategy } from '../../inventory/inventory-accounting';
import {
  findOrder,
  findOrderLine,
  findShipment,
  findShipmentLine,
  assertShipmentQtyAvailable,
  getInvoicedPerLine,
  getCommittedPerLine,
} from '../shipment-helpers';
import { emitEvent } from '../../common/emit-event';
import { EntityType, EventType } from '../../common/event-types';
import { calculateAuditTrail, AuditMode } from '../../common/audit';
import { evaluateLifecycleRules } from '../order-lifecycle-rules';
import { GlService } from '../../gl/gl.service';
import {
  CreateShipmentDto,
  UpdateShipmentDto,
  AddShipmentLineDto,
  UpdateShipmentLineDto,
} from '../dto';

import {
  SHIPMENT_STATE,
  SHIPMENT_TRANSITIONS as SHIPMENT_STATE_TRANSITIONS,
  SALES_ORDER_STATE,
  SALES_ORDER_PICK_STATE,
  SALES_ORDER_PICK_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';
import type { SalesOrderPickState } from '@herobm/shared';
import { InventoryMovementService } from '../../inventory/inventory-movement.service';
import { ShipmentsCoreService } from './shipments-core.service';
import { ShipmentsStateService } from './shipments-state.service';

const VALID_SHIPMENT_STATES = getValidStates(SHIPMENT_STATE_TRANSITIONS);

// ============================================================================
// DTOs
// ============================================================================

// DTOs imported from ./dto

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ShipmentsWriteService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly inventoryMovementService: InventoryMovementService,
    private readonly shipmentsCoreService: ShipmentsCoreService,
    private readonly shipmentsStateService: ShipmentsStateService,
  ) {}

  private readonly logger = new Logger(ShipmentsWriteService.name);

  // -------------------------------------------------------------------------
  // Number generation
  // -------------------------------------------------------------------------
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
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const order = await findOrder(innerTx, salesOrderId);
        if (order.stateCode !== SALES_ORDER_STATE.PICKING) {
          throw new BadRequestException(
            `Cannot create shipment for order in state '${order.stateCode}'. Order must be in ${SALES_ORDER_STATE.PICKING}.`,
          );
        }

        let shipmentLocationId: string | null = null;

        // Validate every line: shipped qty must be available
        for (const line of dto.lines) {
          const orderLine = await findOrderLine(
            innerTx,
            line.salesOrderLineId,
            salesOrderId,
          );

          if (!shipmentLocationId && orderLine.fulfillmentLocationId) {
            shipmentLocationId = orderLine.fulfillmentLocationId;
          } else if (
            shipmentLocationId &&
            orderLine.fulfillmentLocationId &&
            shipmentLocationId !== orderLine.fulfillmentLocationId
          ) {
            throw new BadRequestException(
              `Cannot mix lines from different fulfillment locations in a single shipment. Line ${orderLine.lineNumber} belongs to a different location.`,
            );
          }

          await assertShipmentQtyAvailable(
            innerTx,
            salesOrderId,
            line.salesOrderLineId,
            parseFloat(line.quantityShipped),
            orderLine.lineNumber,
          );
        }

        const shipmentNumber =
          await this.shipmentsCoreService.generateShipmentNumber(innerTx);

        const [shipment] = await innerTx
          .insert(salesOrderShipments)
          .values({
            shipmentNumber,
            salesOrderId,
            stateCode: SHIPMENT_STATE.DRAFT, // Create as draft first, then transition to dispatched
            notes: dto.notes,
            trackingNumber: dto.trackingNumber,
            deliveryCompanyName:
              dto.deliveryCompanyName ?? order.deliveryCompanyName,
            fulfillmentLocationId: shipmentLocationId,
            createdBy: actor,
          })
          .returning();

        const lineValues = dto.lines.map((line) => ({
          shipmentId: shipment.shipmentId,
          salesOrderLineId: line.salesOrderLineId,
          quantityShipped: line.quantityShipped,
        }));

        if (lineValues.length > 0) {
          await innerTx.insert(salesOrderShipmentLines).values(lineValues);
        }

        const stockLines = [];
        for (const line of lineValues) {
          const orderLine = await findOrderLine(
            innerTx,
            line.salesOrderLineId,
            salesOrderId,
          );
          const [product] = orderLine.productId
            ? await innerTx
                .select({
                  productType: coreProducts.productType,
                  structureType: coreProducts.structureType,
                })
                .from(coreProducts)
                .where(eq(coreProducts.productId, orderLine.productId))
            : [undefined];

          const isStocked =
            Boolean(orderLine.productId) &&
            (!product ||
              !product.productType ||
              product.productType === 'inventory');

          stockLines.push({
            productId: orderLine.productId,
            quantity: line.quantityShipped,
            unitCost: orderLine.unitCost,
            isPhysical: isStocked,
          });
        }
        const physicalStockLines = stockLines.filter((l) => l.isPhysical);

        await this.shipmentsStateService.executeDispatch(
          innerTx,
          shipment,
          lineValues,
          physicalStockLines,
          actor,
        );

        // Transition to dispatched — MUST happen after lines are inserted so lifecycle rules see the shipped qty
        const updatedShipment =
          await this.shipmentsStateService.changeShipmentState(
            shipment.shipmentId,
            SHIPMENT_STATE.DISPATCHED,
            actor,
            innerTx,
            true,
          );

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipment.shipmentId,
          eventType: EventType.SHIPMENT_CREATED,
          entityDisplayName: shipmentNumber,
          payload: {
            shipmentId: shipment.shipmentId,
            shipmentNumber,
            lineCount: lineValues.length,
          },
          actor,
        });

        return updatedShipment;
      },
    );

    this.logger.log(
      `Shipment created: ${result.shipmentNumber} for order ${salesOrderId} with ${dto.lines.length} lines by ${actor}`,
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
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode === SHIPMENT_STATE.CANCELLED) {
          throw new BadRequestException(`Cannot update a cancelled shipment.`);
        }

        const audit = calculateAuditTrail(dto, shipment, AuditMode.DIFF);

        if (audit.hasChanges) {
          const [updated] = await innerTx
            .update(salesOrderShipments)
            .set({
              ...audit.changes,
              modifiedOn: new Date(),
            } as typeof salesOrderShipments.$inferInsert)
            .where(eq(salesOrderShipments.shipmentId, shipmentId))
            .returning();

          await emitEvent(innerTx, {
            entityType: EntityType.SHIPMENT,
            entityId: shipmentId,
            eventType: EventType.SHIPMENT_UPDATED,
            entityDisplayName: shipment.shipmentNumber,
            payload: {
              shipmentId,
              changes: audit.changes,
              previous: audit.previousValues,
            },
            actor,
          });

          return updated;
        }
        return shipment;
      },
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
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode !== SHIPMENT_STATE.DRAFT) {
          throw new BadRequestException(
            `Cannot add lines to shipment in state '${shipment.stateCode}'`,
          );
        }

        const orderLine = await findOrderLine(
          innerTx,
          dto.salesOrderLineId,
          shipment.salesOrderId,
        );
        await assertShipmentQtyAvailable(
          innerTx,
          shipment.salesOrderId,
          dto.salesOrderLineId,
          parseFloat(dto.quantityShipped),
          orderLine.lineNumber,
        );

        const [line] = await innerTx
          .insert(salesOrderShipmentLines)
          .values({
            shipmentId,
            salesOrderLineId: dto.salesOrderLineId,
            quantityShipped: dto.quantityShipped,
          })
          .returning();

        await innerTx
          .update(salesOrderShipments)
          .set({ modifiedOn: new Date() })
          .where(eq(salesOrderShipments.shipmentId, shipmentId));

        await emitEvent(innerTx, {
          entityType: EntityType.SHIPMENT,
          entityId: shipmentId,
          eventType: EventType.SHIPMENT_LINE_ADDED,
          entityDisplayName: shipment.shipmentNumber,
          payload: {
            shipmentId,
            shipmentLineId: line.shipmentLineId,
            salesOrderLineId: dto.salesOrderLineId,
            quantityShipped: dto.quantityShipped,
          },
          actor,
        });

        return line;
      },
    );

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
    tx?: DrizzleDB,
  ) {
    const result = await (tx || this.db).transaction(
      async (innerTx: DrizzleDB) => {
        const shipment = await findShipment(innerTx, shipmentId);

        if (shipment.stateCode !== SHIPMENT_STATE.DRAFT) {
          throw new BadRequestException(
            `Cannot update lines for shipment in state '${shipment.stateCode}'`,
          );
        }

        const existingLine = await findShipmentLine(
          innerTx,
          lineId,
          shipmentId,
        );

        if (dto.quantityShipped !== undefined) {
          const orderLine = await findOrderLine(
            innerTx,
            existingLine.salesOrderLineId,
            shipment.salesOrderId,
          );
          await assertShipmentQtyAvailable(
            innerTx,
            shipment.salesOrderId,
            existingLine.salesOrderLineId,
            parseFloat(dto.quantityShipped),
            orderLine.lineNumber,
            lineId,
          );
        }

        const audit = calculateAuditTrail(dto, existingLine, AuditMode.DIFF);

        if (audit.hasChanges) {
          const [updated] = await innerTx
            .update(salesOrderShipmentLines)
            .set({
              ...audit.changes,
            } as typeof salesOrderShipmentLines.$inferInsert)
            .where(eq(salesOrderShipmentLines.shipmentLineId, lineId))
            .returning();

          await innerTx
            .update(salesOrderShipments)
            .set({ modifiedOn: new Date() })
            .where(eq(salesOrderShipments.shipmentId, shipmentId));

          await emitEvent(innerTx, {
            entityType: EntityType.SHIPMENT,
            entityId: shipmentId,
            eventType: EventType.SHIPMENT_LINE_UPDATED,
            entityDisplayName: shipment.shipmentNumber,
            payload: {
              shipmentId,
              shipmentLineId: lineId,
              changes: audit.changes,
              previous: audit.previousValues,
            },
            actor,
          });

          return updated;
        }
        return existingLine;
      },
    );

    return result;
  }

  /**
   * Remove a shipment line.
   */
  async removeShipmentLine(
    shipmentId: string,
    lineId: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    await (tx || this.db).transaction(async (innerTx: DrizzleDB) => {
      const shipment = await findShipment(innerTx, shipmentId);

      if (shipment.stateCode !== SHIPMENT_STATE.DRAFT) {
        throw new BadRequestException(
          `Cannot remove lines from shipment in state '${shipment.stateCode}'`,
        );
      }

      const existingLine = await findShipmentLine(innerTx, lineId, shipmentId);

      await innerTx
        .delete(salesOrderShipmentLines)
        .where(eq(salesOrderShipmentLines.shipmentLineId, lineId));

      await innerTx
        .update(salesOrderShipments)
        .set({ modifiedOn: new Date() })
        .where(eq(salesOrderShipments.shipmentId, shipmentId));

      await emitEvent(innerTx, {
        entityType: EntityType.SHIPMENT,
        entityId: shipmentId,
        eventType: EventType.SHIPMENT_LINE_REMOVED,
        entityDisplayName: shipment.shipmentNumber,
        payload: {
          shipmentId,
          shipmentLineId: lineId,
          salesOrderLineId: existingLine.salesOrderLineId,
          quantityShipped: existingLine.quantityShipped,
        },
        actor,
      });
    });
  }

  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------
}
