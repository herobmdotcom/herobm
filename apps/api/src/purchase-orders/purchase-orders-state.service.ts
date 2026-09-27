import Decimal from 'decimal.js';
import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  backorders,
  purchaseInvoices,
  purchaseInvoiceLines,
  procurementEvents,
} from '@herobm/db-schema';
import { eq, sql, and, inArray } from 'drizzle-orm';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import {
  PURCHASE_ORDER_STATE,
  PURCHASE_ORDER_TRANSITIONS,
  getValidStates,
  getAllowedTransitions,
  PURCHASE_INVOICE_STATE,
  BACKORDER_STATE,
} from '@herobm/shared';
import type { PurchaseOrderState } from '@herobm/shared';

import { SuppliersService } from '../suppliers/suppliers.service';
import { BackordersService } from '../orders/backorders.service';
import { PurchaseOrdersQueryService } from './purchase-orders-query.service';

@Injectable()
export class PurchaseOrdersStateService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleDB,
    private readonly suppliersService: SuppliersService,
    private readonly queryService: PurchaseOrdersQueryService,
    @Inject(forwardRef(() => BackordersService))
    private readonly backordersService: BackordersService,
  ) {}

  async changePurchaseOrderState(
    id: string,
    stateCode: PurchaseOrderState,
    actor: string = 'system',
    tx?: DrizzleDB,
    bypassValidation: boolean = false,
  ) {
    const db = tx || this.db;
    const validStates = getValidStates(PURCHASE_ORDER_TRANSITIONS);
    if (!validStates.includes(stateCode)) {
      throw new BadRequestException(`Invalid state: '${stateCode}'`);
    }

    const existing = await this.queryService.findOne(id, db);
    if (!existing)
      throw new NotFoundException(`Purchase Order ${id} not found`);
    if (existing.stateCode === stateCode) return existing;

    if (!bypassValidation) {
      const allowed = getAllowedTransitions(
        PURCHASE_ORDER_TRANSITIONS,
        existing.stateCode,
      );
      if (!allowed.includes(stateCode)) {
        throw new BadRequestException(
          `Cannot transition from '${existing.stateCode}' to '${stateCode}'. Allowed transitions: ${allowed.join(', ') || 'none'}`,
        );
      }
    }

    if (
      existing.stateCode === PURCHASE_ORDER_STATE.DRAFT &&
      stateCode === PURCHASE_ORDER_STATE.ORDERED
    ) {
      if (!existing.deliveryLocationId) {
        throw new BadRequestException(
          'Cannot order: A Delivery Location must be specified.',
        );
      }

      const risk = await this.suppliersService.assessRisk(
        existing.vendorId || '',
        db,
      );
      if (risk.isPurchasingBlocked) {
        throw new BadRequestException(
          `Cannot order: Supplier purchasing is blocked. Reasons: ${risk.purchasingBlockReasons.join(', ')}`,
        );
      }
    }

    if (stateCode === PURCHASE_ORDER_STATE.DRAFT) {
      const anyReceived = existing.lines.some(
        (l: { quantityReceived?: string | null }) =>
          parseFloat(l.quantityReceived || '0') > 0,
      );
      if (anyReceived) {
        throw new BadRequestException(
          'Cannot move to Draft: Goods have already been received against this Purchase Order.',
        );
      }

      const invoiceLines = await db
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.purchaseOrderId, id))
        .limit(1);

      if (invoiceLines.length > 0) {
        throw new BadRequestException(
          'Cannot move to Draft: Invoices are attached to this Purchase Order.',
        );
      }
    }

    if (stateCode === PURCHASE_ORDER_STATE.CANCELLED) {
      const anyReceived = existing.lines.some(
        (l: { quantityReceived?: string | null }) =>
          parseFloat(l.quantityReceived || '0') > 0,
      );
      if (anyReceived) {
        throw new BadRequestException(
          'Cannot cancel a Purchase Order that has received goods. Use Close Short instead.',
        );
      }

      const invoiceLines = await db
        .select()
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.purchaseOrderId, id))
        .limit(1);

      if (invoiceLines.length > 0) {
        throw new BadRequestException(
          'Cannot cancel a Purchase Order that has attached invoices.',
        );
      }
    }

    if (stateCode === PURCHASE_ORDER_STATE.CLOSED_SHORT) {
      const receivedLines = (existing.lines || []).filter(
        (l: {
          quantityReceived?: string | null;
          purchaseOrderLineId: string;
        }) => parseFloat(l.quantityReceived || '0') > 0,
      );
      const receivedPoLineIds = receivedLines.map(
        (l: { purchaseOrderLineId: string }) => l.purchaseOrderLineId,
      );

      const invoicedRows =
        receivedPoLineIds.length > 0
          ? await db
              .select({
                purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
                totalInvoiced: sql<string>`COALESCE(SUM(CAST(${purchaseInvoiceLines.quantityInvoiced} AS NUMERIC)), 0)::text`,
              })
              .from(purchaseInvoiceLines)
              .innerJoin(
                purchaseInvoices,
                eq(purchaseInvoiceLines.invoiceId, purchaseInvoices.invoiceId),
              )
              .where(
                and(
                  inArray(
                    purchaseInvoiceLines.purchaseOrderLineId,
                    receivedPoLineIds,
                  ),
                  eq(
                    purchaseInvoices.stateCode,
                    PURCHASE_INVOICE_STATE.INVOICED,
                  ),
                ),
              )
              .groupBy(purchaseInvoiceLines.purchaseOrderLineId)
          : [];

      const invoicedMap = new Map<string, Decimal>(
        invoicedRows
          .filter(
            (r): r is typeof r & { purchaseOrderLineId: string } =>
              !!r.purchaseOrderLineId,
          )
          .map((r) => [
            r.purchaseOrderLineId,
            new Decimal(r.totalInvoiced || '0'),
          ]),
      );

      for (const line of receivedLines) {
        const received = new Decimal(line.quantityReceived || '0');
        const invoiced =
          invoicedMap.get(line.purchaseOrderLineId) || new Decimal(0);
        if (received.greaterThan(invoiced.plus('0.001'))) {
          throw new BadRequestException(
            `Cannot close short: Received quantities for product ${line.productNumber} must be fully invoiced first. Received: ${received.toString()}, Invoiced: ${invoiced.toString()}`,
          );
        }
      }
    }

    return await db.transaction(async (innerTx: DrizzleDB) => {
      const updated = await this.changeInternalPurchaseOrderState(
        id,
        stateCode,
        actor,
        innerTx,
      );

      if (
        stateCode === PURCHASE_ORDER_STATE.CANCELLED ||
        stateCode === PURCHASE_ORDER_STATE.CLOSED_SHORT
      ) {
        await this.backordersService.unlinkDemandForPurchaseOrder(
          innerTx,
          id,
          actor,
        );
      }

      return updated;
    });
  }

  async archive(id: string, actor: string) {
    const existing = await this.queryService.findOne(id);

    if (
      existing.stateCode !== PURCHASE_ORDER_STATE.RECEIVED &&
      existing.stateCode !== PURCHASE_ORDER_STATE.INVOICED &&
      existing.stateCode !== PURCHASE_ORDER_STATE.CLOSED_SHORT &&
      existing.stateCode !== PURCHASE_ORDER_STATE.CANCELLED
    ) {
      throw new BadRequestException(
        `Purchase Order must be '${PURCHASE_ORDER_STATE.RECEIVED}', '${PURCHASE_ORDER_STATE.INVOICED}', '${PURCHASE_ORDER_STATE.CLOSED_SHORT}', or '${PURCHASE_ORDER_STATE.CANCELLED}' to be archived (current state: '${existing.stateCode}')`,
      );
    }

    return await this.changePurchaseOrderState(
      id,
      PURCHASE_ORDER_STATE.ARCHIVED,
      actor,
    );
  }

  async unarchive(id: string, actor: string) {
    const existing = await this.queryService.findOne(id);

    if (existing.stateCode !== PURCHASE_ORDER_STATE.ARCHIVED) {
      throw new BadRequestException(`Purchase Order is not archived`);
    }

    const lastEvent = await this.db
      .select()
      .from(procurementEvents)
      .where(
        sql`${procurementEvents.entityId} = ${id} AND ${procurementEvents.eventType} = ${EventType.ARCHIVED}`,
      )
      .orderBy(sql`${procurementEvents.createdOn} DESC`)
      .limit(1);

    const previousState =
      ((lastEvent[0]?.payload as Record<string, unknown>)?.from as string) ||
      PURCHASE_ORDER_STATE.CANCELLED;

    return await this.changePurchaseOrderState(
      id,
      previousState as PurchaseOrderState,
      actor,
    );
  }

  private async changeInternalPurchaseOrderState(
    purchaseOrderId: string,
    newState: PurchaseOrderState,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const VALID_STATES = getValidStates(PURCHASE_ORDER_TRANSITIONS);
    if (!VALID_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid PO state: '${newState}'`);
    }

    const db = tx || this.db;
    const [existing] = await db
      .select({
        stateCode: purchaseOrders.stateCode,
        orderNumber: purchaseOrders.orderNumber,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .limit(1);

    if (!existing) {
      throw new NotFoundException(
        `Purchase Order ${purchaseOrderId} not found`,
      );
    }

    const allowed = PURCHASE_ORDER_TRANSITIONS[existing.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition PO from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await db
      .update(purchaseOrders)
      .set({
        stateCode: newState,
        modifiedOn: new Date(),
      })
      .where(eq(purchaseOrders.purchaseOrderId, purchaseOrderId))
      .returning();

    const eventPayload = {
      entity: 'purchase_order',
      entityId: purchaseOrderId,
      orderNumber: existing.orderNumber,
      from: existing.stateCode,
      to: newState,
    };

    if (newState === PURCHASE_ORDER_STATE.ARCHIVED) {
      await emitEvent(db, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.ARCHIVED,
        entityDisplayName: existing.orderNumber,
        payload: eventPayload,
        actor,
      });
    } else if (existing.stateCode === PURCHASE_ORDER_STATE.ARCHIVED) {
      await emitEvent(db, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.UNARCHIVED,
        entityDisplayName: existing.orderNumber,
        payload: eventPayload,
        actor,
      });
    } else {
      await emitEvent(db, {
        entityType: EntityType.PURCHASE_ORDER,
        entityId: purchaseOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing.orderNumber,
        payload: eventPayload,
        actor,
      });
    }

    return updated;
  }
}
