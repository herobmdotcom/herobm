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
  asc,
  and,
  or,
  ilike,
  inArray,
  getTableColumns,
} from 'drizzle-orm';
import {
  PaginationQuery,
  parsePagination,
  withCursorPagination,
} from '../common/pagination';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  salesCreditNotes,
  salesCreditNoteLines,
  salesOrderReturns,
  salesOrderReturnLines,
  salesOrderLineItems,
  salesOrders,
  salesInvoices,
  glAccounts,
  glJournalEntries,
  glJournalLines,
  customers as coreAccounts,
  products as coreProducts,
  customerGroups,
  actors,
  salesEvents,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { TaxCategoriesService } from '../tax/tax-categories.service';
import { OrganizationService } from '../settings/organization.service';
import { AppConfigService } from '../settings/app-config.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { CreateSalesCreditNoteDto } from './sales-credit-notes.dto';
import { computeLinePrice, computeReturnCreditSummary } from '@herobm/shared';
import {
  SALES_CREDIT_NOTE_STATE,
  SALES_CREDIT_NOTE_TRANSITIONS,
  SALES_INVOICE_STATE,
  RETURN_STATE,
  getErrorMessage,
  getValidStates,
} from '@herobm/shared';
import { getAvailableToCredit } from '../orders/order-math.utils';
import {
  getCommittedPerLine,
  getInvoicedPerLine,
} from '../orders/shipment-helpers';

const VALID_CN_STATES = getValidStates(SALES_CREDIT_NOTE_TRANSITIONS);

@Injectable()
export class SalesCreditNoteService {
  private readonly logger = new Logger(SalesCreditNoteService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly taxService: TaxCategoriesService,
    private readonly appConfig: AppConfigService,
    private readonly organizationService: OrganizationService,
    private readonly enrichmentService: EnrichmentService,
  ) {}

  /**
   * Generate a human-readable credit note number (CN-YYYYMMDD-NNNN).
   */
  private async generateCreditNoteNumber(tx?: DrizzleDB): Promise<string> {
    const db = tx || this.db;
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CN-${today}-`;
    const result = await db
      .select({ creditNoteNumber: salesCreditNotes.creditNoteNumber })
      .from(salesCreditNotes)
      .where(sql`${salesCreditNotes.creditNoteNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${salesCreditNotes.creditNoteNumber} DESC`)
      .limit(1);
    const seq =
      result.length > 0
        ? parseInt(result[0].creditNoteNumber.replace(prefix, ''), 10) + 1
        : 1;
    return `${prefix}${String(seq).padStart(4, '0')}`;
  }

  /**
   * Create a credit note (either from a return, or ad-hoc).
   */
  async createCreditNote(
    dto: CreateSalesCreditNoteDto,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const queryDb = tx || this.db;

    return await queryDb.transaction(async (innerTx: DrizzleDB) => {
      if (!dto.returnId) {
        return this.createAdhocCreditNote(dto, actor, innerTx);
      }

      const returnId = dto.returnId;
      // 1. Load the return + order context
      const [ret] = await innerTx
        .select()
        .from(salesOrderReturns)
        .where(eq(salesOrderReturns.returnId, returnId))
        .limit(1);
      if (!ret) {
        throw new NotFoundException(`Return '${returnId}' not found`);
      }

      const [order] = await innerTx
        .select()
        .from(salesOrders)
        .where(eq(salesOrders.salesOrderId, ret.salesOrderId))
        .limit(1);
      if (!order) {
        throw new NotFoundException(`Order '${ret.salesOrderId}' not found`);
      }

      // 2. Resolve GL settings
      const settings = await this.glService.getSettings(innerTx);
      if (!settings?.defaultArAccountId || !settings?.defaultRevenueAccountId) {
        this.logger.warn(
          'GL settings incomplete — skipping credit note GL posting',
        );
        return null;
      }

      // Resolve customer codes from settings IDs
      const settingsIds = [
        settings.defaultArAccountId,
        settings.defaultRevenueAccountId,
        settings.defaultSalesTaxAccountId,
        settings.defaultFeeRevenueAccountId,
      ].filter((id): id is string => !!id);

      const acctRows = await innerTx
        .select({
          glAccountId: glAccounts.glAccountId,
          accountCode: glAccounts.accountCode,
        })
        .from(glAccounts)
        .where(
          sql`${glAccounts.glAccountId} IN (${sql.join(
            settingsIds.map((id) => sql`${id}`),
            sql`, `,
          )})`,
        );

      const idToCode = new Map(
        acctRows.map((a) => [a.glAccountId, a.accountCode]),
      );
      const arCode = idToCode.get(settings.defaultArAccountId);
      const revCode = settings.defaultRevenueAccountId
        ? idToCode.get(settings.defaultRevenueAccountId)
        : null;
      const taxCode = settings.defaultSalesTaxAccountId
        ? idToCode.get(settings.defaultSalesTaxAccountId)
        : null;
      const feeCode =
        (settings.defaultFeeRevenueAccountId
          ? idToCode.get(settings.defaultFeeRevenueAccountId)
          : null) || revCode;

      if (!arCode || !revCode) {
        this.logger.warn(
          'AR or Revenue customer code not found — skipping credit note GL',
        );
        return null;
      }

      // 3. Resolve customer cost center / activity dimensions
      let customerCostCenterId: string | undefined;
      let customerActivityId: string | undefined;
      let billingAddressCountry: string | null = null;
      let billingAddressPostalCode: string | null = null;
      let billingAddressStateOrProvince: string | null = null;
      let billingAddressCity: string | null = null;
      let billingAddressLine1: string | null = null;

      if (order.customerId) {
        const [custInfo] = await innerTx
          .select({
            costCenterId: customerGroups.defaultCostCenterId,
            activityId: customerGroups.defaultActivityId,
          })
          .from(coreAccounts)
          .leftJoin(
            customerGroups,
            eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
          )
          .where(
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              order.customerId,
            )
              ? eq(coreAccounts.customerId, order.customerId)
              : eq(coreAccounts.externalId, order.customerId),
          );

        if (custInfo) {
          customerCostCenterId = custInfo.costCenterId || undefined;
          customerActivityId = custInfo.activityId || undefined;
          billingAddressCountry = null;
          billingAddressPostalCode = null;
          billingAddressStateOrProvince = null;
          billingAddressCity = null;
          billingAddressLine1 = null;
        }
      }

      // 4. Fetch return lines + join to order lines for pricing + tax
      const returnLines = await innerTx
        .select()
        .from(salesOrderReturnLines)
        .where(eq(salesOrderReturnLines.returnId, returnId));

      const transitionReturnToProcessed = async () => {
        await innerTx
          .update(salesOrderReturns)
          // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
          .set({ stateCode: RETURN_STATE.PROCESSED, modifiedOn: new Date() })
          .where(eq(salesOrderReturns.returnId, returnId));

        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle transaction type mismatch with Outbox emitter
        await emitEvent(innerTx as any, {
          entityType: EntityType.SALES_ORDER,
          entityId: ret.salesOrderId,
          eventType: EventType.STATUS_CHANGED,
          entityDisplayName: order.orderNumber,
          payload: {
            entity: 'return',
            entityId: returnId,
            from: ret.stateCode,
            to: RETURN_STATE.PROCESSED,
            returnNumber: ret.returnNumber,
          },
          actor,
        });
      };

      if (returnLines.length === 0) {
        this.logger.log(
          'No lines found on return — skipping credit note generation, marking return as PROCESSED',
        );
        await transitionReturnToProcessed();
        return null;
      }

      // Pre-fetch shipping and invoicing stats for the order
      const shippedQtyMap = await getCommittedPerLine(
        innerTx,
        ret.salesOrderId,
      );
      const invoicedQtyMap = await getInvoicedPerLine(
        innerTx,
        ret.salesOrderId,
      );

      const priorCredits = await innerTx
        .select({
          salesOrderLineId: salesCreditNoteLines.salesOrderLineId,
          quantityCredited: salesCreditNoteLines.quantityCredited,
        })
        .from(salesCreditNoteLines)
        .innerJoin(
          salesCreditNotes,
          eq(salesCreditNoteLines.creditNoteId, salesCreditNotes.creditNoteId),
        )
        .where(eq(salesCreditNotes.salesOrderId, ret.salesOrderId));

      const creditedQtyMap = new Map<string, number>();
      for (const pc of priorCredits) {
        const current = creditedQtyMap.get(pc.salesOrderLineId!) || 0;
        creditedQtyMap.set(
          pc.salesOrderLineId!,
          current + parseFloat(pc.quantityCredited),
        );
      }

      let totalCreditAmount = 0;
      let totalTaxAmount = 0;
      let totalFees = 0;
      const cnLineValues: Array<{
        salesOrderLineId: string;
        quantityCredited: string;
        pricePerUnit: string;
        amount: string;
        taxAmount: string;
        taxCategoryId: string | null;
        externalTaxCode: string | null;
        discountPercentage: string;
        quantity: number;
        tax: number;
        productType?: string;
        productNumber?: string | null;
        productName?: string | null;
        productDescription?: string;
        description?: string | null;
        accountId?: string | null;
      }> = [];
      const creditLineInputs: Array<{
        quantity: number;
        pricePerUnit: number;
        discountPercentage: number;
        taxRate: number;
        returnFee: number;
        resolution?: string;
      }> = [];

      for (const rl of returnLines) {
        const orderLine = await innerTx
          .select({
            ...getTableColumns(salesOrderLineItems),
            externalTaxCode: coreProducts.externalTaxCode,
            productType: coreProducts.productType,
            productNumber: coreProducts.productNumber,
            productName: coreProducts.name,
          })
          .from(salesOrderLineItems)
          .leftJoin(
            coreProducts,
            eq(salesOrderLineItems.productId, coreProducts.productId),
          )
          .where(eq(salesOrderLineItems.salesOrderLineId, rl.salesOrderLineId))
          .limit(1)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle select intersection is too complex for static inference
          .then((r: any[]) => r[0]);

        if (!orderLine) continue;

        const prodNumber = rl.productNumber || orderLine.productNumber || null;
        const prodName =
          rl.productName ||
          orderLine.productName ||
          orderLine.productDescription ||
          null;

        const unitPriceStr = rl.pricePerUnit || orderLine.pricePerUnit || '0';
        const unitPrice = parseFloat(unitPriceStr);
        const discStr =
          rl.discountPercentage || orderLine.discountPercentage || '0';
        const disc = parseFloat(discStr);
        const refundedQty = parseFloat(rl.quantityReturned || '0');
        const fee = parseFloat(rl.returnFee || '0');

        const shipped = shippedQtyMap.get(rl.salesOrderLineId) || 0;
        const invoiced = invoicedQtyMap.get(rl.salesOrderLineId) || 0;
        const previouslyCredited = creditedQtyMap.get(rl.salesOrderLineId) || 0;

        const isRefund = rl.resolution === 'refund';
        const totalRefunded = previouslyCredited + refundedQty;
        const creditableQty = isRefund
          ? Math.min(
              refundedQty,
              getAvailableToCredit(
                shipped,
                invoiced,
                totalRefunded,
                previouslyCredited,
              ),
            )
          : 0;

        if (creditableQty <= 0 && fee <= 0) continue;

        const qty = creditableQty;

        // Resolve per-line tax rate
        let taxRate = 0;
        if (orderLine.taxCategoryId) {
          try {
            const cat = await this.taxService.getById(
              orderLine.taxCategoryId,
              innerTx,
            );
            taxRate = parseFloat(cat.rate ?? '0');
          } catch (err: unknown) {
            if (err instanceof NotFoundException) {
              // Category not found — fall back to 0%
            } else {
              throw err;
            }
          }
        }

        const pricing = computeLinePrice({
          quantity: qty,
          pricePerUnit: unitPrice,
          discountPercentage: disc,
          taxRate,
        });

        const resolvedDescription =
          prodName || (prodNumber ? `Product ${prodNumber}` : null);

        cnLineValues.push({
          salesOrderLineId: rl.salesOrderLineId,
          quantityCredited: String(qty),
          pricePerUnit: unitPriceStr,
          amount: pricing.amount.toFixed(2),
          taxAmount: pricing.tax.toFixed(2),
          taxCategoryId: orderLine.taxCategoryId || rl.taxCategoryId || null,
          externalTaxCode: orderLine.externalTaxCode,
          discountPercentage: discStr,
          quantity: qty,
          tax: pricing.tax,
          productType: orderLine.productType,
          productNumber: prodNumber,
          productName: prodName,
          productDescription: orderLine.productDescription,
          description: resolvedDescription,
          accountId: settings.defaultRevenueAccountId,
        });

        creditLineInputs.push({
          quantity: qty,
          pricePerUnit: unitPrice,
          discountPercentage: disc,
          taxRate,
          returnFee: fee,
          resolution: rl.resolution,
        });
      }

      // Centralised totals calculation
      const creditSummary = computeReturnCreditSummary(creditLineInputs);
      totalCreditAmount = creditSummary.subtotal;
      totalTaxAmount = creditSummary.totalTax;
      totalFees = creditSummary.totalFees;

      if (totalCreditAmount <= 0 && totalFees <= 0) {
        this.logger.warn(
          'No credit amount or fee to post — skipping credit note, marking return as PROCESSED',
        );
        await transitionReturnToProcessed();
        return null;
      }

      // Net AR credit = credit amount + tax - fees
      const netArCredit = creditSummary.netCredit;

      // 5. Find the most recent posted invoice for this order (if any)
      const [latestInvoice] = await innerTx
        .select({ invoiceId: salesInvoices.invoiceId })
        .from(salesInvoices)
        .where(eq(salesInvoices.salesOrderId, ret.salesOrderId))
        .orderBy(desc(salesInvoices.createdOn))
        .limit(1);

      // 6. Create the credit note document
      const creditNoteNumber = await this.generateCreditNoteNumber(innerTx);

      const [creditNote] = await innerTx
        .insert(salesCreditNotes)
        .values({
          creditNoteNumber,
          customerId: order.customerId!,
          returnId,
          salesOrderId: ret.salesOrderId,
          invoiceId: latestInvoice?.invoiceId ?? null,
          totalAmount: totalCreditAmount.toFixed(2),
          taxAmount: totalTaxAmount.toFixed(2),
          feeAmount: totalFees.toFixed(2),
          outstandingAmount: netArCredit.toFixed(2),
          currencyCode: order.currencyCode,
          stateCode: SALES_CREDIT_NOTE_STATE.POSTED,
          notes: dto.notes ?? `Credit note for return ${ret.returnNumber}`,
          createdBy: actor,
          baseTotalAmount: '0',
          baseOutstandingAmount: '0',
          exchangeRate: '1',
        })
        .returning();

      // 7. Create credit note lines
      if (cnLineValues.length > 0) {
        await innerTx.insert(salesCreditNoteLines).values(
          cnLineValues.map((line) => ({
            creditNoteId: creditNote.creditNoteId,
            salesOrderLineId: line.salesOrderLineId,
            quantityCredited: line.quantityCredited,
            pricePerUnit: line.pricePerUnit,
            amount: line.amount,
            taxAmount: line.taxAmount,
            taxCategoryId: line.taxCategoryId,
            discountPercentage: line.discountPercentage,
            description: line.description,
            productNumber: line.productNumber,
            productName: line.productName,
            accountId: line.accountId,
          })),
        );
      }

      const sysDefaultCC = this.appConfig.defaultCostCenterId();
      const sysDefaultAct = this.appConfig.defaultActivityId();
      const finalCC = customerCostCenterId || sysDefaultCC || undefined;
      const finalAct = customerActivityId || sysDefaultAct || undefined;

      // 8. Post the GL journal entry (reverse of sales invoice)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
      const glLines: any[] = [
        {
          accountCode: revCode,
          debit: totalCreditAmount,
          credit: 0,
          memo: `Sales return: ${ret.returnNumber}`,
          costCenterId: finalCC,
          activityId: finalAct,
        },
        {
          accountCode: arCode,
          debit: 0,
          credit: netArCredit,
          memo: `Credit note: ${creditNoteNumber}`,
          partyType: 'customer',
          partyId: order.customerId,
          costCenterId: finalCC,
          activityId: finalAct,
        },
      ];

      if (taxCode && totalTaxAmount > 0) {
        glLines.push({
          accountCode: taxCode,
          debit: totalTaxAmount,
          credit: 0,
          memo: `GST reversal: ${ret.returnNumber}`,
          costCenterId: finalCC,
          activityId: finalAct,
        });
      }

      if (totalFees > 0 && feeCode) {
        glLines.push({
          accountCode: feeCode,
          debit: 0,
          credit: totalFees,
          memo: `Restocking fee: ${ret.returnNumber}`,
          costCenterId: finalCC,
          activityId: finalAct,
        });
      }

      await this.glService.postJournalEntry(
        glLines,
        {
          sourceType: 'sales_credit_note',
          sourceId: creditNote.creditNoteId,
          memo: `Credit note ${creditNoteNumber} for return ${ret.returnNumber} on order ${order.orderNumber}`,
          actor,
        },
        innerTx,
      );

      // Record Refund in External Engine if applicable
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Order DTO missing taxProvider in strict types
      const orderTaxProvider = (order as any).taxProvider;
      if (
        orderTaxProvider &&
        orderTaxProvider !== 'internal' &&
        !orderTaxProvider.endsWith('-error')
      ) {
        const org = await this.organizationService.get(innerTx);
        const freightLines = cnLineValues.filter(
          (l) => l.productType === 'freight',
        );
        const taxableLines = cnLineValues.filter(
          (l) => l.productType !== 'freight',
        );

        const shippingTotal = freightLines.reduce((sum, l) => {
          const discountAmt =
            l.quantity *
            parseFloat(l.pricePerUnit) *
            (parseFloat(l.discountPercentage) / 100);
          return sum + l.quantity * parseFloat(l.pricePerUnit) - discountAmt;
        }, 0);

        const payload = {
          transaction_id: creditNote.creditNoteId,
          transaction_reference_id:
            latestInvoice?.invoiceId ?? order.salesOrderId,
          transaction_date: new Date().toISOString(),
          amount: totalCreditAmount,
          shipping: shippingTotal,
          sales_tax: totalTaxAmount,
          from_country: org.country || 'US',
          from_zip: org.postCode,
          from_state: org.state,
          from_city: org.city,
          from_street: org.addressLine1,
          to_country: billingAddressCountry || 'US',
          to_zip: billingAddressPostalCode,
          to_state: billingAddressStateOrProvince,
          to_city: billingAddressCity,
          to_street: billingAddressLine1,
          line_items: taxableLines.map((l) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
            const payloadLine: any = {
              id: l.salesOrderLineId,
              product_identifier: l.productNumber,
              description: l.productDescription,
              quantity: l.quantity,
              unit_price: parseFloat(l.pricePerUnit),
              discount:
                parseFloat(l.pricePerUnit) *
                (parseFloat(l.discountPercentage) / 100) *
                l.quantity,
              sales_tax: l.tax,
            };
            if (l.externalTaxCode) {
              payloadLine.product_tax_code = l.externalTaxCode;
            }
            return payloadLine;
          }),
        };
        try {
          const enrichRes = await this.enrichmentService.recordRefund(
            orderTaxProvider,
            payload,
            innerTx,
          );
          if (!enrichRes.isValid) {
            const errObj = enrichRes.data?.error;
            const errMsg =
              errObj instanceof Error
                ? errObj.message
                : typeof errObj === 'string'
                  ? errObj
                  : JSON.stringify(errObj);
            throw new BadRequestException(
              `Tax provider rejected refund: ${errMsg}`,
            );
          }
          this.logger.log(
            `Refund recorded in ${orderTaxProvider} for credit note ${creditNoteNumber}`,
          );
        } catch (e: unknown) {
          this.logger.error(
            `Failed to record refund in ${orderTaxProvider}`,
            e,
          );
          throw new BadRequestException(
            `Failed to record refund in ${orderTaxProvider}: ${getErrorMessage(e)}`,
          );
        }
      }

      // Mark the return as PROCESSED
      await innerTx
        .update(salesOrderReturns)
        // eslint-disable-next-line no-restricted-syntax -- Dynamic state transition from state machine logic
        .set({ stateCode: RETURN_STATE.PROCESSED, modifiedOn: new Date() })
        .where(eq(salesOrderReturns.returnId, returnId));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle transaction type mismatch with Outbox emitter
      await emitEvent(innerTx as any, {
        entityType: EntityType.SALES_ORDER,
        entityId: ret.salesOrderId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: order.orderNumber,
        payload: {
          entity: 'return',
          entityId: returnId,
          from: ret.stateCode,
          to: RETURN_STATE.PROCESSED,
          returnNumber: ret.returnNumber,
        },
        actor,
      });

      const [customer] = order.customerId
        ? await innerTx
            .select({ name: actors.name })
            .from(coreAccounts)
            .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
            .where(eq(coreAccounts.customerId, order.customerId))
        : [null];

      // 9. Outbox event
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle transaction type mismatch with Outbox emitter
      await emitEvent(innerTx as any, {
        entityType: EntityType.SALES_ORDER,
        entityId: ret.salesOrderId,
        eventType: EventType.CREDIT_NOTE_POSTED,
        entityDisplayName: order.orderNumber,
        payload: {
          creditNoteId: creditNote.creditNoteId,
          creditNoteNumber,
          returnId,
          returnNumber: ret.returnNumber,
          salesOrderId: ret.salesOrderId,
          orderNumber: order.orderNumber,
          customerId: order.customerId,
          customerName: customer?.name,
          totalCredit: totalCreditAmount,
          totalTax: totalTaxAmount,
          totalFees,
          netCredit: netArCredit,
          currency: order.currencyCode,
        },
        actor,
      });

      this.logger.log(
        `Credit note ${creditNoteNumber} posted for return ${ret.returnNumber}: credit=${totalCreditAmount}, tax=${totalTaxAmount}, fees=${totalFees}, netAR=${netArCredit}`,
      );

      return creditNote;
    });
  }

  /**
   * Find a single credit note by ID.
   */
  /**
   * List all credit notes, optionally filtered.
   */
  async findAll(
    query?: PaginationQuery | string,
    balanceStatus?: string,
    overrideLimit?: number,
  ) {
    let queryObj: PaginationQuery;
    if (typeof query === 'string' || query === undefined) {
      queryObj = {
        customerId: query,
        limit: overrideLimit,
      };
    } else {
      queryObj = query;
    }

    const { limit, cursor, direction, searchTerm, customerId } =
      parsePagination(queryObj);

    let qb = this.db
      .select({
        ...getTableColumns(salesCreditNotes),
        orderNumber: salesOrders.orderNumber,
        salesOrderNumber: salesOrders.orderNumber,
        referenceNumber: salesOrderReturns.returnNumber,
        returnNumber: salesOrderReturns.returnNumber,
        customerNumber: coreAccounts.customerNumber,
        customerName: actors.name,
      })
      .from(salesCreditNotes)
      .leftJoin(
        salesOrders,
        eq(salesCreditNotes.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        salesOrderReturns,
        eq(salesCreditNotes.returnId, salesOrderReturns.returnId),
      )
      .leftJoin(
        coreAccounts,
        eq(salesCreditNotes.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .$dynamic();

    const conditions = [];
    const targetCustomer = queryObj.customerId || customerId;
    if (targetCustomer) {
      conditions.push(eq(salesCreditNotes.customerId, targetCustomer));
    }

    if (balanceStatus === 'unpaid') {
      conditions.push(
        sql`CAST(${salesCreditNotes.outstandingAmount} AS numeric) > 0`,
      );
    }

    if (searchTerm) {
      conditions.push(
        or(
          ilike(salesCreditNotes.creditNoteNumber, searchTerm),
          ilike(salesCreditNotes.notes, searchTerm),
          ilike(coreAccounts.customerNumber, searchTerm),
          ilike(actors.name, searchTerm),
        ),
      );
    }

    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    const {
      data: notes,
      nextCursor,
      prevCursor,
    } = await withCursorPagination({
      qb,
      limit,
      cursorObj: cursor as { createdOn: string; creditNoteId: string } | null,
      direction,
      applyWhere: (q, c, dir) => {
        const dateOp = dir === 'next' ? sql`<` : sql`>`;
        const idOp = dir === 'next' ? sql`<` : sql`>`;
        return q.where(
          or(
            sql`${salesCreditNotes.createdOn} ${dateOp} ${c.createdOn}`,
            and(
              sql`${salesCreditNotes.createdOn} = ${c.createdOn}`,
              sql`${salesCreditNotes.creditNoteId} ${idOp} ${c.creditNoteId}`,
            ),
          ),
        );
      },
      applyOrderBy: (q, dir) => {
        const order = dir === 'next' ? desc : asc;
        return q.orderBy(
          order(salesCreditNotes.createdOn),
          order(salesCreditNotes.creditNoteId),
        );
      },
      encodeRow: (row) => ({
        createdOn: row.createdOn,
        creditNoteId: row.creditNoteId,
      }),
    });

    if (notes.length === 0) {
      return { data: [], limit, nextCursor, prevCursor };
    }

    const noteIds = notes.map((n) => n.creditNoteId);
    const allLines: (typeof salesCreditNoteLines.$inferSelect)[] = [];
    const CHUNK_SIZE = 500;
    for (let i = 0; i < noteIds.length; i += CHUNK_SIZE) {
      const chunk = noteIds.slice(i, i + CHUNK_SIZE);
      const lines = await this.db
        .select()
        .from(salesCreditNoteLines)
        .where(inArray(salesCreditNoteLines.creditNoteId, chunk));
      allLines.push(...lines);
    }

    const linesByNoteId = new Map<string, typeof allLines>();
    for (const line of allLines) {
      const existing = linesByNoteId.get(line.creditNoteId) || [];
      existing.push(line);
      linesByNoteId.set(line.creditNoteId, existing);
    }

    const mappedData = notes.map((cn) => ({
      ...cn,
      lines: linesByNoteId.get(cn.creditNoteId) || [],
    }));

    return { data: mappedData, limit, nextCursor, prevCursor };
  }

  /**
   * Calculate the total credit amount for a return to determine if a credit note is needed.
   */
  async calculateReturnCreditTotal(
    returnId: string,
    tx?: DrizzleDB,
  ): Promise<number> {
    const innerTx = tx || this.db;
    const [ret] = await innerTx
      .select({ salesOrderId: salesOrderReturns.salesOrderId })
      .from(salesOrderReturns)
      .where(eq(salesOrderReturns.returnId, returnId))
      .limit(1);
    if (!ret) return 0;

    const returnLines = await innerTx
      .select({
        salesOrderLineId: salesOrderReturnLines.salesOrderLineId,
        quantityReturned: salesOrderReturnLines.quantityReturned,
        returnFee: salesOrderReturnLines.returnFee,
        resolution: salesOrderReturnLines.resolution,
      })
      .from(salesOrderReturnLines)
      .where(eq(salesOrderReturnLines.returnId, returnId));

    if (returnLines.length === 0) return 0;

    const shippedQtyMap = await getCommittedPerLine(innerTx, ret.salesOrderId);
    const invoicedQtyMap = await getInvoicedPerLine(innerTx, ret.salesOrderId);

    const priorCredits = await innerTx
      .select({
        salesOrderLineId: salesCreditNoteLines.salesOrderLineId,
        quantityCredited: salesCreditNoteLines.quantityCredited,
      })
      .from(salesCreditNoteLines)
      .innerJoin(
        salesCreditNotes,
        eq(salesCreditNoteLines.creditNoteId, salesCreditNotes.creditNoteId),
      )
      .where(eq(salesCreditNotes.salesOrderId, ret.salesOrderId));

    const creditedQtyMap = new Map<string, number>();
    for (const pc of priorCredits) {
      const current = creditedQtyMap.get(pc.salesOrderLineId!) || 0;
      creditedQtyMap.set(
        pc.salesOrderLineId!,
        current + parseFloat(pc.quantityCredited),
      );
    }

    const creditLineInputs: Array<{
      quantity: number;
      pricePerUnit: number;
      discountPercentage: number;
      taxRate: number;
      returnFee: number;
      resolution?: string;
    }> = [];

    for (const rl of returnLines) {
      const orderLine = await innerTx
        .select({
          pricePerUnit: salesOrderLineItems.pricePerUnit,
          discountPercentage: salesOrderLineItems.discountPercentage,
          taxCategoryId: salesOrderLineItems.taxCategoryId,
        })
        .from(salesOrderLineItems)
        .where(eq(salesOrderLineItems.salesOrderLineId, rl.salesOrderLineId))
        .limit(1)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle select intersection is too complex for static inference
        .then((r: any[]) => r[0]);

      if (!orderLine) continue;

      const unitPrice = parseFloat(orderLine.pricePerUnit || '0');
      const disc = parseFloat(orderLine.discountPercentage || '0');
      const refundedQty = parseFloat(rl.quantityReturned || '0');
      const fee = parseFloat(rl.returnFee || '0');

      const shipped = shippedQtyMap.get(rl.salesOrderLineId) || 0;
      const invoiced = invoicedQtyMap.get(rl.salesOrderLineId) || 0;
      const previouslyCredited = creditedQtyMap.get(rl.salesOrderLineId) || 0;

      const isRefund = rl.resolution === 'refund';
      const creditableQty = isRefund
        ? getAvailableToCredit(
            shipped,
            invoiced,
            refundedQty,
            previouslyCredited,
          )
        : 0;

      if (creditableQty <= 0 && fee <= 0) continue;

      let taxRate = 0;
      if (orderLine.taxCategoryId) {
        try {
          const cat = await this.taxService.getById(
            orderLine.taxCategoryId,
            innerTx,
          );
          taxRate = parseFloat(cat.rate ?? '0');
        } catch (err: unknown) {
          if (err instanceof NotFoundException) {
            // Category not found — fall back to 0%
          } else {
            throw err;
          }
        }
      }

      creditLineInputs.push({
        quantity: creditableQty,
        pricePerUnit: unitPrice,
        discountPercentage: disc,
        taxRate,
        returnFee: fee,
      });
    }

    const creditSummary = computeReturnCreditSummary(creditLineInputs);
    return creditSummary.subtotal;
  }

  private async createAdhocCreditNote(
    dto: CreateSalesCreditNoteDto,
    actor: string,
    innerTx: DrizzleDB,
  ) {
    if (!dto.customerId)
      throw new BadRequestException(
        'customerId is required for ad-hoc credit notes',
      );
    if (!dto.lines || dto.lines.length === 0)
      throw new BadRequestException(
        'lines are required for ad-hoc credit notes',
      );

    const customerId = dto.customerId;

    const [custInfo] = await innerTx
      .select({
        costCenterId: customerGroups.defaultCostCenterId,
        activityId: customerGroups.defaultActivityId,
        currencyCode: coreAccounts.currencyCode,
      })
      .from(coreAccounts)
      .leftJoin(
        customerGroups,
        eq(coreAccounts.customerGroupId, customerGroups.customerGroupId),
      )
      .where(eq(coreAccounts.customerId, customerId));

    if (!custInfo) throw new NotFoundException('Customer not found');

    const currencyCode = custInfo.currencyCode || this.appConfig.homeCurrency();

    const settings = await this.glService.getSettings(innerTx);
    if (!settings?.defaultArAccountId) {
      throw new BadRequestException('GL setting defaultArAccountId is missing');
    }

    const [arAcct] = await innerTx
      .select()
      .from(glAccounts)
      .where(eq(glAccounts.glAccountId, settings.defaultArAccountId));

    if (!arAcct) throw new BadRequestException('AR account not found');

    let totalCreditAmount = 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Array of anonymous complex objects to be inserted
    const glLines: any[] = [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Array of anonymous complex objects to be inserted
    const cnLineValues: any[] = [];

    for (const line of dto.lines) {
      const amount = line.amount;
      totalCreditAmount += amount;

      cnLineValues.push({
        description: line.description,
        amount: amount.toFixed(2),
        accountId: line.accountId,
        taxCategoryId: line.taxCategoryId ?? null,
        quantityCredited: '1',
        pricePerUnit: amount.toFixed(2),
      });

      const [acct] = await innerTx
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, line.accountId));
      if (!acct)
        throw new BadRequestException(`Account ${line.accountId} not found`);

      glLines.push({
        accountCode: acct.accountCode,
        debit: amount,
        credit: 0,
        memo: line.description,
        costCenterId: custInfo.costCenterId || undefined,
        activityId: custInfo.activityId || undefined,
      });
    }

    glLines.push({
      accountCode: arAcct.accountCode,
      debit: 0,
      credit: totalCreditAmount,
      memo: dto.notes ?? 'Ad-hoc credit note',
      partyType: 'customer',
      partyId: customerId,
      costCenterId: custInfo.costCenterId || undefined,
      activityId: custInfo.activityId || undefined,
    });

    const creditNoteNumber = await this.generateCreditNoteNumber(innerTx);

    const [creditNote] = await innerTx
      .insert(salesCreditNotes)
      .values({
        creditNoteNumber,
        customerId,
        totalAmount: totalCreditAmount.toFixed(2),
        taxAmount: '0.00',
        feeAmount: '0.00',
        outstandingAmount: totalCreditAmount.toFixed(2),
        currencyCode,
        stateCode: SALES_CREDIT_NOTE_STATE.POSTED,
        notes: dto.notes ?? 'Ad-hoc credit note',
        createdBy: actor,
        baseTotalAmount: '0',
        baseOutstandingAmount: '0',
        exchangeRate: '1',
      })
      .returning();

    await innerTx.insert(salesCreditNoteLines).values(
      cnLineValues.map((l) => ({
        creditNoteId: creditNote.creditNoteId,
        ...l,
      })),
    );

    await this.glService.postJournalEntry(
      glLines,
      {
        sourceType: 'sales_credit_note',
        sourceId: creditNote.creditNoteId,
        memo: dto.notes ?? `Ad-hoc credit note ${creditNoteNumber}`,
        actor,
      },
      innerTx,
    );

    await emitEvent(innerTx as unknown as DrizzleDB, {
      entityType: EntityType.SALES_INVOICE,
      entityId: creditNote.creditNoteId,
      eventType: EventType.CREDIT_NOTE_POSTED,
      entityDisplayName: creditNoteNumber,
      payload: {},
      actor,
    });

    this.logger.log(
      `Ad-hoc credit note ${creditNoteNumber} posted for customer ${customerId}: credit=${totalCreditAmount}`,
    );
    return creditNote;
  }

  /**
   * Find a single credit note by ID.
   */
  async findOne(creditNoteId: string, tx?: DrizzleDB) {
    const db = tx || this.db;
    const rows = await db
      .select({
        ...getTableColumns(salesCreditNotes),
        customerNumber: coreAccounts.customerNumber,
        customerName: actors.name,
        orderNumber: salesOrders.orderNumber,
        returnNumber: salesOrderReturns.returnNumber,
      })
      .from(salesCreditNotes)
      .leftJoin(
        coreAccounts,
        eq(salesCreditNotes.customerId, coreAccounts.customerId),
      )
      .leftJoin(actors, eq(coreAccounts.actorId, actors.actorId))
      .leftJoin(
        salesOrders,
        eq(salesCreditNotes.salesOrderId, salesOrders.salesOrderId),
      )
      .leftJoin(
        salesOrderReturns,
        eq(salesCreditNotes.returnId, salesOrderReturns.returnId),
      )
      .where(eq(salesCreditNotes.creditNoteId, creditNoteId))
      .limit(1);

    if (rows.length === 0) {
      throw new NotFoundException(`Credit note '${creditNoteId}' not found`);
    }
    const cn = rows[0];

    const rawLines = await db
      .select({
        ...getTableColumns(salesCreditNoteLines),
        returnFee: salesOrderReturnLines.returnFee,
        returnReason: salesOrderReturnLines.reason,
      })
      .from(salesCreditNoteLines)
      .leftJoin(
        salesOrderReturnLines,
        and(
          eq(
            salesCreditNoteLines.salesOrderLineId,
            salesOrderReturnLines.salesOrderLineId,
          ),
          cn.returnId
            ? eq(salesOrderReturnLines.returnId, cn.returnId)
            : undefined,
        ),
      )
      .where(eq(salesCreditNoteLines.creditNoteId, creditNoteId));

    const lines = rawLines.map((l) => ({
      ...l,
      description:
        l.productName ||
        l.description ||
        (l.productNumber ? `Product ${l.productNumber}` : null),
      returnFee: l.returnFee || '0',
    }));

    const events = await db
      .select({
        eventId: salesEvents.eventId,
        eventType: salesEvents.eventType,
        payload: salesEvents.payload,
        actor: salesEvents.actor,
        createdOn: salesEvents.createdOn,
      })
      .from(salesEvents)
      .where(
        or(
          eq(salesEvents.entityId, creditNoteId),
          sql`${salesEvents.payload}->>'creditNoteId' = ${creditNoteId}`,
          sql`${salesEvents.payload}->>'creditNoteNumber' = ${cn.creditNoteNumber}`,
        ),
      )
      .orderBy(desc(salesEvents.createdOn));

    return { ...cn, lines, events };
  }

  /**
   * List credit notes for a specific order.
   */
  async findByOrder(salesOrderId: string) {
    const notes = await this.db
      .select()
      .from(salesCreditNotes)
      .where(eq(salesCreditNotes.salesOrderId, salesOrderId))
      .orderBy(desc(salesCreditNotes.createdOn));

    const result = [];
    for (const cn of notes) {
      const lines = await this.db
        .select()
        .from(salesCreditNoteLines)
        .where(eq(salesCreditNoteLines.creditNoteId, cn.creditNoteId));
      result.push({ ...cn, lines });
    }

    return result;
  }

  /**
   * List credit notes for a specific invoice.
   */
  async findByInvoice(invoiceId: string) {
    return this.db
      .select()
      .from(salesCreditNotes)
      .where(eq(salesCreditNotes.invoiceId, invoiceId))
      .orderBy(desc(salesCreditNotes.createdOn));
  }

  /**
   * Transition credit note state.
   */
  async changeCreditNoteState(
    creditNoteId: string,
    newState: string,
    actor: string,
    tx?: DrizzleDB,
  ) {
    const doChange = async (db: DrizzleDB) => {
      if (!VALID_CN_STATES.includes(newState)) {
        throw new BadRequestException(
          `Invalid credit note state: '${newState}'`,
        );
      }

      const existing = await this.findOne(creditNoteId, db);
      const allowed = SALES_CREDIT_NOTE_TRANSITIONS[existing.stateCode];

      if (!allowed || !allowed.includes(newState)) {
        throw new BadRequestException(
          `Cannot transition credit note from '${existing.stateCode}' to '${newState}'. ` +
            `Allowed transitions: ${allowed?.join(', ') || 'none'}`,
        );
      }

      if (newState === SALES_CREDIT_NOTE_STATE.CANCELLED) {
        const [originalEntry] = await db
          .select()
          .from(glJournalEntries)
          .where(
            and(
              eq(glJournalEntries.sourceType, 'sales_credit_note'),
              eq(glJournalEntries.sourceId, creditNoteId),
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

          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
          const reversedLines: any[] = originalLines.map((line) => ({
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
            reversedLines,
            {
              sourceId: creditNoteId,
              sourceType: 'sales_credit_note',
              memo: `Reversal of Sales Credit Note ${existing.creditNoteNumber}`,
              entryDate: new Date().toISOString().slice(0, 10),
              actor,
            },
            db,
          );
        }
      }

      const [updated] = await db
        .update(salesCreditNotes)
        .set({ stateCode: newState, modifiedOn: new Date() })
        .where(eq(salesCreditNotes.creditNoteId, creditNoteId))
        .returning();

      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Drizzle transaction type mismatch with Outbox emitter
      await emitEvent(db as any, {
        entityType: EntityType.SALES_ORDER,
        entityId: existing.salesOrderId || creditNoteId,
        eventType: EventType.STATUS_CHANGED,
        entityDisplayName: existing.creditNoteNumber,
        payload: {
          entity: 'sales_credit_note',
          entityId: creditNoteId,
          from: existing.stateCode,
          to: newState,
          creditNoteNumber: existing.creditNoteNumber,
        },
        actor,
      });

      this.logger.log(
        `Credit note ${existing.creditNoteNumber} state: ${existing.stateCode} → ${newState} by ${actor}`,
      );

      return updated;
    };

    return tx ? await doChange(tx) : await this.db.transaction(doChange);
  }
}
