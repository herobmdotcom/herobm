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

const VALID_SHIPMENT_STATES = getValidStates(SHIPMENT_STATE_TRANSITIONS);

// ============================================================================
// DTOs
// ============================================================================

// DTOs imported from ./dto

// ============================================================================
// Service
// ============================================================================

@Injectable()
export class ShipmentsCoreService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly appConfig: AppConfigService,
    private readonly glService: GlService,
    private readonly inventoryMovementService: InventoryMovementService,
  ) {}

  private readonly logger = new Logger(ShipmentsCoreService.name);

  // -------------------------------------------------------------------------
  // Number generation
  // -------------------------------------------------------------------------

  async generateShipmentNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `SHP-${today}-`;

    const result = await db
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
  // -------------------------------------------------------------------------
  // Read operations
  // -------------------------------------------------------------------------

  async findOne(shipmentId: string) {
    const rows = await this.db
      .select({
        shipmentId: salesOrderShipments.shipmentId,
        shipmentNumber: salesOrderShipments.shipmentNumber,
        salesOrderId: salesOrderShipments.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: actors.name,
        stateCode: salesOrderShipments.stateCode,
        notes: salesOrderShipments.notes,
        trackingNumber: salesOrderShipments.trackingNumber,
        createdBy: salesOrderShipments.createdBy,
        createdOn: salesOrderShipments.createdOn,
        modifiedOn: salesOrderShipments.modifiedOn,
        deliveryCompanyName: sql<
          string | null
        >`COALESCE(${salesOrders.deliveryCompanyName}, ${actors.name})`,
        deliveryName: salesOrders.deliveryName,
        deliveryPhone: salesOrders.deliveryPhone,
        deliveryAddressLine1: salesOrders.deliveryAddressLine1,
        deliveryAddressLine2: salesOrders.deliveryAddressLine2,
        deliveryCity: salesOrders.deliveryCity,
        deliveryState: salesOrders.deliveryState,
        deliveryPostalCode: salesOrders.deliveryPostalCode,
        deliveryCountry: salesOrders.deliveryCountry,
        shippingNotes: salesOrders.shippingNotes,
      })
      .from(salesOrderShipments)
      .innerJoin(
        salesOrders,
        eq(salesOrderShipments.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .where(eq(salesOrderShipments.shipmentId, shipmentId))
      .limit(1);

    if (rows.length === 0) {
      // Try fetching as a Transfer Order Shipment instead
      const transferRows = await this.db
        .select({
          shipmentId: transferOrderShipments.shipmentId,
          shipmentNumber: transferOrderShipments.shipmentNumber,
          salesOrderId: transferOrderShipments.transferOrderId,
          orderNumber: transferOrders.orderNumber,
          customerId: locations.locationId,
          customerName: locations.name,
          stateCode: transferOrderShipments.stateCode,
          notes: transferOrders.notes,
          trackingNumber: transferOrderShipments.trackingNumber,
          createdBy: transferOrderShipments.shippedBy,
          createdOn: transferOrderShipments.createdOn,
          modifiedOn: transferOrderShipments.shippedOn,
          deliveryCompanyName: sql<string | null>`NULL`,
          deliveryName: locations.name,
          deliveryPhone: sql<string | null>`NULL`,
          deliveryAddressLine1: locations.addressLine1,
          deliveryAddressLine2: sql<string | null>`NULL`,
          deliveryCity: locations.city,
          deliveryState: locations.stateOrProvince,
          deliveryPostalCode: locations.postalCode,
          deliveryCountry: locations.country,
          shippingNotes: transferOrders.shippingNotes,
        })
        .from(transferOrderShipments)
        .innerJoin(
          transferOrders,
          eq(
            transferOrderShipments.transferOrderId,
            transferOrders.transferOrderId,
          ),
        )
        .leftJoin(
          locations,
          eq(transferOrders.destinationLocationId, locations.locationId),
        )
        .where(eq(transferOrderShipments.shipmentId, shipmentId))
        .limit(1);

      if (transferRows.length === 0) {
        throw new NotFoundException(`Shipment '${shipmentId}' not found`);
      }

      const shipment = transferRows[0];

      const lines = await this.db
        .select({
          shipmentLineId: transferOrderShipmentLines.shipmentLineId,
          salesOrderLineId: transferOrderShipmentLines.transferOrderLineId,
          quantityShipped: transferOrderShipmentLines.quantity,
          productId: transferOrderLines.productId,
          productNumber: coreProducts.productNumber,
          productDescription: coreProducts.name,
          orderNumber: transferOrders.orderNumber,
        })
        .from(transferOrderShipmentLines)
        .innerJoin(
          transferOrderLines,
          eq(
            transferOrderShipmentLines.transferOrderLineId,
            transferOrderLines.transferOrderLineId,
          ),
        )
        .innerJoin(
          transferOrders,
          eq(
            transferOrderLines.transferOrderId,
            transferOrders.transferOrderId,
          ),
        )
        .leftJoin(
          coreProducts,
          eq(transferOrderLines.productId, coreProducts.productId),
        )
        .where(eq(transferOrderShipmentLines.shipmentId, shipmentId));

      const events = await this.db
        .select({
          eventId: warehouseEvents.eventId,
          entityType: warehouseEvents.entityType,
          entityId: warehouseEvents.entityId,
          eventType: warehouseEvents.eventType,
          payload: warehouseEvents.payload,
          actor: warehouseEvents.actor,
          createdOn: warehouseEvents.createdOn,
        })
        .from(warehouseEvents)
        .where(
          and(
            eq(warehouseEvents.entityType, EntityType.SHIPMENT),
            eq(warehouseEvents.entityId, shipmentId),
          ),
        )
        .orderBy(desc(warehouseEvents.createdOn));

      return { ...shipment, lines, events };
    }

    const shipment = rows[0];

    const lines = await this.db
      .select({
        shipmentLineId: salesOrderShipmentLines.shipmentLineId,
        salesOrderLineId: salesOrderShipmentLines.salesOrderLineId,
        quantityShipped: salesOrderShipmentLines.quantityShipped,
        productId: salesOrderLineItems.productId,
        productNumber: coreProducts.productNumber,
        productDescription: salesOrderLineItems.productDescription,
        orderNumber: salesOrders.orderNumber,
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        salesOrderLineItems,
        eq(
          salesOrderShipmentLines.salesOrderLineId,
          salesOrderLineItems.salesOrderLineId,
        ),
      )
      .innerJoin(
        salesOrders,
        eq(salesOrderLineItems.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreProducts,
        eq(salesOrderLineItems.productId, coreProducts.productId),
      )
      .where(eq(salesOrderShipmentLines.shipmentId, shipmentId));

    const events = await this.db
      .select({
        eventId: warehouseEvents.eventId,
        entityType: warehouseEvents.entityType,
        entityId: warehouseEvents.entityId,
        eventType: warehouseEvents.eventType,
        payload: warehouseEvents.payload,
        actor: warehouseEvents.actor,
        createdOn: warehouseEvents.createdOn,
      })
      .from(warehouseEvents)
      .where(
        and(
          eq(warehouseEvents.entityType, EntityType.SHIPMENT),
          eq(warehouseEvents.entityId, shipmentId),
        ),
      )
      .orderBy(desc(warehouseEvents.createdOn));

    return { ...shipment, lines, events };
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

  /**
   * Fetch a flattened, global list of Sales Order Shipments.
   * Useful for the "All Shipments" page.
   */
  async findAll(query: {
    days?: number;
    salesOrderId?: string;
    limit?: number;
  }) {
    const { days = 30, salesOrderId, limit = 100 } = query;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
    const conditions: any[] = [];

    if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(salesOrderShipments.createdOn, cutoffDate));
    }

    if (salesOrderId) {
      conditions.push(eq(salesOrderShipments.salesOrderId, salesOrderId));
    }

    const data = await this.db
      .select({
        shipmentId: salesOrderShipments.shipmentId,
        shipmentNumber: salesOrderShipments.shipmentNumber,
        salesOrderId: salesOrderShipments.salesOrderId,
        orderNumber: salesOrders.orderNumber,
        customerId: salesOrders.customerId,
        customerName: actors.name,
        stateCode: salesOrderShipments.stateCode,
        createdOn: salesOrderShipments.createdOn,
        notes: salesOrderShipments.notes,
        trackingNumber: salesOrderShipments.trackingNumber,
      })
      .from(salesOrderShipments)
      .innerJoin(
        salesOrders,
        eq(salesOrderShipments.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesOrders.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .where(and(...conditions))
      .orderBy(desc(salesOrderShipments.createdOn))
      .limit(limit > 0 ? limit : 100);

    if (data.length === 0) return [];

    const shipmentIds = data.map((s) => s.shipmentId);

    // Fetch PO mappings for these shipments via backorder allocations
    const poLinks = await this.db
      .select({
        shipmentId: salesOrderShipmentLines.shipmentId,
        poNumber: purchaseOrders.orderNumber,
      })
      .from(salesOrderShipmentLines)
      .innerJoin(
        backorders,
        eq(
          salesOrderShipmentLines.salesOrderLineId,
          backorders.salesOrderLineId,
        ),
      )
      .innerJoin(
        purchaseOrders,
        eq(backorders.purchaseOrderId, purchaseOrders.purchaseOrderId),
      )
      .where(
        sql`${salesOrderShipmentLines.shipmentId} IN (${sql.join(
          shipmentIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      );

    const poMap = new Map<string, Set<string>>();
    for (const link of poLinks) {
      if (!poMap.has(link.shipmentId)) poMap.set(link.shipmentId, new Set());
      if (link.poNumber) poMap.get(link.shipmentId)!.add(link.poNumber);
    }

    return data.map((s) => ({
      ...s,
      purchaseOrders: Array.from(poMap.get(s.shipmentId) || []),
    }));
  }
}
