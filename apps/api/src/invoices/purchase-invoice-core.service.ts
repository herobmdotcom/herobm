import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  eq,
  sql,
  desc,
  and,
  inArray,
  gte,
  or,
  asc,
  lt,
  gt,
  ilike,
} from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  purchaseOrders,
  purchaseInvoices,
  purchaseInvoiceLines,
  purchaseOrderLineItems,
  suppliers,
  products as coreProducts,
  glJournalEntries,
  glJournalLines,
  purchaseInvoiceReceipts,
  paymentAllocations,
  paymentEntries,
  actors,
} from '../drizzle/schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { AppConfigService } from '../settings/app-config.service';

import {
  PURCHASE_INVOICE_STATE,
  PURCHASE_INVOICE_TRANSITIONS,
  getValidStates,
} from '@herobm/shared';
import { withCursorPagination } from '../common/pagination';

const VALID_INVOICE_STATES = getValidStates(PURCHASE_INVOICE_TRANSITIONS);

@Injectable()
export class PurchaseInvoiceCoreService {
  private readonly logger = new Logger(PurchaseInvoiceCoreService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
  ) {}

  // ───────────────────────── Shared helpers ─────────────────────────

  /**
   * Generates a structural sequence number for the internal AP bill record natively in HeroBM.
   */
  async generateBillNumber(): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `BILL-${today}-`;

    const result = await this.db
      .select({ invoiceNumber: purchaseInvoices.invoiceNumber })
      .from(purchaseInvoices)
      .where(sql`${purchaseInvoices.invoiceNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${purchaseInvoices.invoiceNumber} DESC`)
      .limit(1);

    const seq =
      result.length > 0
        ? parseInt(result[0].invoiceNumber.replace(prefix, ''), 10) + 1
        : 1;

    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  // @herobm-skip-audit
  async recalculateInvoiceTotals(invoiceId: string, tx: DrizzleDB) {
    const lines = await tx
      .select({ amount: purchaseInvoiceLines.amount })
      .from(purchaseInvoiceLines)
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    let lineTotal = 0;
    for (const line of lines) {
      lineTotal += parseFloat(line.amount || '0');
    }

    const [invoice] = await tx
      .select()
      .from(purchaseInvoices)
      .where(eq(purchaseInvoices.invoiceId, invoiceId));

    const taxAmt = parseFloat(invoice.taxAmount || '0');
    const newTotal = lineTotal + taxAmt;

    // @herobm-skip-audit
    await tx
      .update(purchaseInvoices)
      .set({
        totalAmount: newTotal.toFixed(2),
        outstandingAmount: newTotal.toFixed(2),
      })
      .where(eq(purchaseInvoices.invoiceId, invoiceId));
  }

  // @herobm-skip-audit
  async changePurchaseInvoiceStateInternal(
    invoiceId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    if (!VALID_INVOICE_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid invoice state: '${newState}'`);
    }

    const execute = async (db: DrizzleDB) => {
      const [existing] = await db
        .select({
          stateCode: purchaseInvoices.stateCode,
          invoiceNumber: purchaseInvoices.invoiceNumber,
        })
        .from(purchaseInvoices)
        .where(eq(purchaseInvoices.invoiceId, invoiceId))
        .for('update')
        .limit(1);

      if (!existing) {
        throw new NotFoundException(`Invoice ${invoiceId} not found`);
      }

      const allowed = PURCHASE_INVOICE_TRANSITIONS[existing.stateCode];
      if (!allowed || !allowed.includes(newState)) {
        throw new BadRequestException(
          `Cannot transition invoice from '${existing.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
        );
      }

      // If transitioning to CANCELLED, we must reverse the associated GL entries synchronously
      if (newState === PURCHASE_INVOICE_STATE.CANCELLED) {
        const [originalEntry] = await db
          .select()
          .from(glJournalEntries)
          .where(
            and(
              eq(glJournalEntries.sourceType, 'purchase_invoice'),
              eq(glJournalEntries.sourceId, invoiceId),
            ),
          )
          .limit(1);

        if (originalEntry) {
          const originalLines = await db
            .select()
            .from(glJournalLines)
            .where(
              eq(glJournalLines.journalEntryId, originalEntry.journalEntryId),
            );

          const reversedLines = originalLines.map((line) => ({
            accountId: line.glAccountId,
            debit: parseFloat(line.credit),
            credit: parseFloat(line.debit),
            memo: `Cancellation Reversal: ${line.memo}`,
            costCenterId: line.costCenterId,
            activityId: line.activityId,
            partyType: line.partyType,
            partyId: line.partyId,
          }));

          await this.glService.postJournalEntry(
            reversedLines as Parameters<GlService['postJournalEntry']>[0],
            {
              sourceId: invoiceId,
              sourceType: 'purchase_invoice_reversal',
              memo: `Reversal of Purchase Invoice ${existing.invoiceNumber}`,
              entryDate: new Date().toISOString().slice(0, 10),
              actor,
            },
            db,
          );
        }
      }

      const [updated] = await db
        .update(purchaseInvoices)
        .set({
          // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
          stateCode: newState,
          modifiedOn: new Date(),
        })
        .where(eq(purchaseInvoices.invoiceId, invoiceId))
        .returning();

      await emitEvent(db, {
        entityType: EntityType.PURCHASE_INVOICE,
        entityId: invoiceId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing.invoiceNumber,
        payload: {
          entity: 'purchase_invoice',
          entityId: invoiceId,
          invoiceNumber: existing.invoiceNumber,
          from: existing.stateCode,
          to: newState,
        },
        actor,
      });

      return updated;
    };

    if (tx) {
      return await execute(tx);
    } else {
      return await this.db.transaction(execute);
    }
  }

  // ───────────────────────── Query methods ─────────────────────────

  /**
   * Fetch a specific HeroBM AP Bill with natively populated mappings structurally
   */
  async findOne(invoiceId: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select({
        invoice: purchaseInvoices,
        vendorName: actors.name,
      })
      .from(purchaseInvoices)
      .leftJoin(suppliers, eq(purchaseInvoices.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .where(eq(purchaseInvoices.invoiceId, invoiceId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Bill '${invoiceId}' not found directly.`);
    }

    const invoiceEntity = rows[0].invoice || rows[0];
    const invoice = { ...invoiceEntity, vendorName: rows[0].vendorName };

    // Hydrate explicitly native HeroBM line mapping structurally
    const lines = await db
      .select({
        lineId: purchaseInvoiceLines.invoiceLineId,
        matchStatus: purchaseInvoiceLines.matchStatus,
        description: purchaseInvoiceLines.description,
        quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
        pricePerUnit: purchaseInvoiceLines.pricePerUnit,
        amount: purchaseInvoiceLines.amount,
        productId: purchaseInvoiceLines.productId,
        productNumber: coreProducts.productNumber,
        glAccountId: purchaseInvoiceLines.glAccountId,
        purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
        purchaseOrderNumber: purchaseOrders.orderNumber,
        purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
        goodsReceivedLineId: purchaseInvoiceReceipts.goodsReceivedLineId,
        quantityBilled: purchaseInvoiceReceipts.quantityBilled,
        poLineQuantityOrdered: purchaseOrderLineItems.quantity,
        poLineQuantityReceived: purchaseOrderLineItems.quantityReceived,
        poLinePricePerUnit: purchaseOrderLineItems.pricePerUnit,
      })
      .from(purchaseInvoiceLines)
      .leftJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .leftJoin(
        purchaseOrders,
        eq(
          purchaseOrderLineItems.purchaseOrderId,
          purchaseOrders.purchaseOrderId,
        ),
      )
      .leftJoin(
        coreProducts,
        eq(purchaseInvoiceLines.productId, coreProducts.productId),
      )
      .leftJoin(
        purchaseInvoiceReceipts,
        eq(
          purchaseInvoiceLines.invoiceLineId,
          purchaseInvoiceReceipts.invoiceLineId,
        ),
      )
      .where(eq(purchaseInvoiceLines.invoiceId, invoiceId));

    const allocations = await db
      .select({
        allocationId: paymentAllocations.allocationId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        paymentId: paymentEntries.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentDate: paymentEntries.paymentDate,
        currencyCode: paymentEntries.currencyCode,
      })
      .from(paymentAllocations)
      .innerJoin(
        paymentEntries,
        eq(paymentAllocations.paymentId, paymentEntries.paymentId),
      )
      .where(
        and(
          eq(paymentAllocations.referenceId, invoiceId),
          eq(paymentAllocations.referenceType, 'purchase_invoice'),
        ),
      );

    return { ...invoice, lines, allocations };
  }

  /**
   * Fetch all Native HeroBM Bills strictly tied to a distinct active purchase order.
   * Finds any invoice that has lines matched to the purchase order.
   */
  async findByOrder(purchaseOrderId: string) {
    const linesRows = await this.db
      .select({
        invoiceId: purchaseInvoiceLines.invoiceId,
      })
      .from(purchaseInvoiceLines)
      .innerJoin(
        purchaseOrderLineItems,
        eq(
          purchaseInvoiceLines.purchaseOrderLineId,
          purchaseOrderLineItems.purchaseOrderLineId,
        ),
      )
      .where(eq(purchaseOrderLineItems.purchaseOrderId, purchaseOrderId));

    const matchedInvoiceIds = [
      ...new Set(linesRows.map((r) => r.invoiceId).filter(Boolean)),
    ];

    if (matchedInvoiceIds.length === 0) return [];

    const invoices = await this.db
      .select()
      .from(purchaseInvoices)
      .where(
        sql`${purchaseInvoices.invoiceId} IN (${sql.join(
          matchedInvoiceIds.map((id) => sql`${id}`),
          sql`, `,
        )})`,
      )
      .orderBy(desc(purchaseInvoices.createdOn));

    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((i) => i.invoiceId);
    if (invoiceIds.length > 0) {
      const allLines = await this.db
        .select({
          lineId: purchaseInvoiceLines.invoiceLineId,
          invoiceId: purchaseInvoiceLines.invoiceId,
          purchaseOrderLineId: purchaseInvoiceLines.purchaseOrderLineId,
          quantityInvoiced: purchaseInvoiceLines.quantityInvoiced,
          pricePerUnit: purchaseInvoiceLines.pricePerUnit,
          amount: purchaseInvoiceLines.amount,
          productId: purchaseInvoiceLines.productId,
          productNumber: coreProducts.productNumber,
          description: purchaseInvoiceLines.description,
          poLineDescription: purchaseOrderLineItems.productDescription,
          purchaseOrderId: purchaseOrderLineItems.purchaseOrderId,
          purchaseOrderNumber: purchaseOrders.orderNumber,
        })
        .from(purchaseInvoiceLines)
        .leftJoin(
          purchaseOrderLineItems,
          eq(
            purchaseInvoiceLines.purchaseOrderLineId,
            purchaseOrderLineItems.purchaseOrderLineId,
          ),
        )
        .leftJoin(
          purchaseOrders,
          eq(
            purchaseOrderLineItems.purchaseOrderId,
            purchaseOrders.purchaseOrderId,
          ),
        )
        .leftJoin(
          coreProducts,
          eq(purchaseInvoiceLines.productId, coreProducts.productId),
        )
        .where(
          sql`${purchaseInvoiceLines.invoiceId} IN (${sql.join(
            invoiceIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      const groupedLines = new Map<string, (typeof allLines)[0][]>();
      for (const line of allLines) {
        if (!groupedLines.has(line.invoiceId)) {
          groupedLines.set(line.invoiceId, []);
        }
        groupedLines.get(line.invoiceId)!.push(line);
      }

      return invoices.map((inv) => ({
        ...inv,
        lines: groupedLines.get(inv.invoiceId) || [],
      }));
    }

    return invoices;
  }

  /**
   * Fetch a flattened, global list of Purchase Invoices spanning multiple orders.
   * Useful for the "All Invoices" page and Customer Detail tabs.
   */
  async findActiveInvoices(query: {
    days?: number;
    vendorId?: string;
    invoiceId?: string;
    balanceStatus?: string;
    limit?: number;
    cursor?: unknown;
    direction?: 'next' | 'prev';
    searchTerm?: string | null;
  }) {
    const {
      days = 30,
      vendorId,
      invoiceId,
      balanceStatus,
      limit = 100,
      cursor,
      direction = 'next',
      searchTerm,
    } = query;

    const conditions: import('drizzle-orm').SQL[] = [];

    // When filtering by specific invoiceId, skip the date range filter
    if (invoiceId) {
      conditions.push(eq(purchaseInvoices.invoiceId, invoiceId));
    } else if (days > 0) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      conditions.push(gte(purchaseInvoices.createdOn, cutoffDate));
    }

    if (vendorId) {
      conditions.push(
        or(
          eq(purchaseInvoices.vendorId, vendorId),
          eq(suppliers.externalId, vendorId),
        ) as import('drizzle-orm').SQL,
      );
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(sql`${purchaseInvoices.outstandingAmount}::numeric > 0`);
    } else if (balanceStatus === 'paid') {
      conditions.push(sql`${purchaseInvoices.outstandingAmount}::numeric <= 0`);
    }

    const rawSearchTerm = searchTerm ? searchTerm.replace(/^%+|%+$/g, '') : '';
    const scoreSql = searchTerm
      ? sql<number>`
          CASE 
            WHEN ${purchaseInvoices.invoiceNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseInvoices.invoiceNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${purchaseInvoices.supplierInvoiceNumber} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${purchaseInvoices.supplierInvoiceNumber} ILIKE ${rawSearchTerm + '%'} THEN 2
            WHEN ${actors.name} ILIKE ${rawSearchTerm} THEN 3
            WHEN ${actors.name} ILIKE ${rawSearchTerm + '%'} THEN 2
            ELSE 1
          END
        `
      : sql<number>`0::int`;

    if (searchTerm) {
      conditions.push(
        or(
          ilike(purchaseInvoices.invoiceNumber, `%${rawSearchTerm}%`),
          ilike(purchaseInvoices.supplierInvoiceNumber, `%${rawSearchTerm}%`),
          ilike(actors.name, `%${rawSearchTerm}%`),
        ) as import('drizzle-orm').SQL,
      );
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    let dataQuery = this.db
      .select({
        invoiceId: purchaseInvoices.invoiceId,
        invoiceNumber: purchaseInvoices.invoiceNumber,
        vendorId: purchaseInvoices.vendorId,
        vendorName: actors.name,
        supplierInvoiceNumber: purchaseInvoices.supplierInvoiceNumber,
        totalAmount: purchaseInvoices.totalAmount,
        taxAmount: purchaseInvoices.taxAmount,
        outstandingAmount: purchaseInvoices.outstandingAmount,
        currencyCode: purchaseInvoices.currencyCode,
        stateCode: purchaseInvoices.stateCode,
        createdOn: purchaseInvoices.createdOn,
        earlyPaymentDiscount: purchaseInvoices.earlyPaymentDiscount,
        earlyPaymentDiscountDays: purchaseInvoices.earlyPaymentDiscountDays,
        score: scoreSql,
      })
      .from(purchaseInvoices)
      .leftJoin(suppliers, eq(purchaseInvoices.vendorId, suppliers.vendorId))
      .leftJoin(actors, eq(suppliers.actorId, actors.actorId))
      .$dynamic();

    if (whereClause) {
      dataQuery = dataQuery.where(whereClause);
    }

    return await withCursorPagination({
      qb: dataQuery,
      limit,
      cursorObj: cursor as {
        score: number;
        createdOn: string;
        invoiceId: string;
      } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const op = dir === 'next' ? lt : gt;
        const cursorCond = or(
          op(scoreSql, c.score),
          and(
            eq(scoreSql, c.score),
            op(purchaseInvoices.createdOn, new Date(c.createdOn)),
          ),
          and(
            eq(scoreSql, c.score),
            eq(purchaseInvoices.createdOn, new Date(c.createdOn)),
            op(purchaseInvoices.invoiceId, c.invoiceId),
          ),
        ) as import('drizzle-orm').SQL;
        return q.where(whereClause ? and(whereClause, cursorCond) : cursorCond);
      },
      applyOrderBy: (q, dir) => {
        const op = dir === 'next' ? desc : asc;
        return q.orderBy(
          op(scoreSql),
          op(purchaseInvoices.createdOn),
          op(purchaseInvoices.invoiceId),
        );
      },
      encodeRow: (row) => ({
        score: Number(row.score) || 0,
        createdOn: row.createdOn
          ? new Date(row.createdOn).toISOString()
          : new Date().toISOString(),
        invoiceId: row.invoiceId,
      }),
    });
  }
}
