import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Decimal } from 'decimal.js';
import { eq, sql, and, inArray } from 'drizzle-orm';
import type { AnyPgColumn, PgTable } from 'drizzle-orm/pg-core';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  paymentEntries,
  paymentAllocations,
  salesInvoices,
  purchaseInvoices,
  salesCreditNotes,
  purchaseDebitNotes,
  customers,
  customerGroups,
  suppliers,
  supplierGroups,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import {
  EntityType,
  type EntityTypeValue,
  EventType,
} from '../common/event-types';

interface AllocatableDoc {
  invoiceId?: string;
  creditNoteId?: string;
  debitNoteId?: string;
  stateCode?: string;
  outstandingAmount?: string | number | null;
  totalAmount?: string | number | null;
  invoiceDate?: string | Date | null;
  dueDate?: string | Date | null;
  paymentTermsDays?: number | null;
  invoiceNumber?: string | null;
  creditNoteNumber?: string | null;
  debitNoteNumber?: string | null;
  [key: string]: unknown;
}
import { randomUUID } from 'crypto';
import { GlService } from '../gl/gl.service';
import { PaymentsCoreService } from './payments-core.service';
import { AllocatePaymentDto } from './dto';
import { JournalLineDto } from '../gl/dto';
import { evaluateSalesInvoiceLifecycleRules } from '../invoices/sales-invoice-lifecycle-rules';
import { evaluatePurchaseInvoiceLifecycleRules } from '../invoices/purchase-invoice-lifecycle-rules';
import {
  PAYMENT_STATE,
  PAYMENT_TYPE,
  type PaymentType,
  SALES_INVOICE_STATE,
  PURCHASE_INVOICE_STATE,
  SALES_CREDIT_NOTE_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  JOURNAL_ENTRY_SOURCE_TYPE,
} from '@herobm/shared';

@Injectable()
export class PaymentsAllocationService {
  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    @Inject(forwardRef(() => PaymentsCoreService))
    private readonly paymentsCoreService: PaymentsCoreService,
  ) {}

  // @herobm-skip-audit
  async allocatePayment(
    paymentId: string,
    dto: AllocatePaymentDto,
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      // 1. Lock payment
      const [payment] = await tx
        .select()
        .from(paymentEntries)
        .where(eq(paymentEntries.paymentId, paymentId))
        .for('update');

      if (!payment)
        throw new NotFoundException(`Payment ${paymentId} not found`);
      if (
        payment.stateCode !== PAYMENT_STATE.DRAFT &&
        payment.stateCode !== PAYMENT_STATE.SUBMITTED
      ) {
        throw new BadRequestException(
          `Payment must be DRAFT or SUBMITTED to allocate. Current state is ${payment.stateCode}`,
        );
      }

      // Clear existing allocations ONLY if it's a draft payment
      if (payment.stateCode === PAYMENT_STATE.DRAFT) {
        await tx
          .delete(paymentAllocations)
          .where(eq(paymentAllocations.paymentId, paymentId));
      }

      let unallocatedAmount = new Decimal(
        payment.stateCode === PAYMENT_STATE.DRAFT
          ? payment.totalAmount
          : payment.unallocatedAmount,
      );

      // Calculate total allocation requested
      const totalRequested = dto.allocations.reduce(
        (sum, a) => sum.plus(new Decimal(a.allocatedAmount || '0')),
        new Decimal(0),
      );
      if (totalRequested.greaterThan(unallocatedAmount.plus(0.001))) {
        throw new BadRequestException(
          `Cannot allocate more than the available unallocated amount (${unallocatedAmount.toString()})`,
        );
      }

      let earlyPaymentDiscount = new Decimal(0);
      let earlyPaymentDiscountDays = 0;

      if (
        (payment.paymentType === PAYMENT_TYPE.CUSTOMER_RECEIPT ||
          payment.paymentType === PAYMENT_TYPE.CUSTOMER_REFUND) &&
        payment.partyId
      ) {
        const [customer] = await tx
          .select()
          .from(customers)
          .where(eq(customers.customerId, payment.partyId));
        const group = customer?.customerGroupId
          ? (
              await tx
                .select()
                .from(customerGroups)
                .where(
                  eq(customerGroups.customerGroupId, customer.customerGroupId),
                )
            )[0]
          : null;

        earlyPaymentDiscount = new Decimal(
          customer?.earlyPaymentDiscount ?? group?.earlyPaymentDiscount ?? '0',
        );
        earlyPaymentDiscountDays =
          customer?.earlyPaymentDiscountDays ??
          group?.earlyPaymentDiscountDays ??
          0;
      } else if (
        (payment.paymentType === PAYMENT_TYPE.SUPPLIER_PAYMENT ||
          payment.paymentType === PAYMENT_TYPE.SUPPLIER_REFUND) &&
        payment.partyId
      ) {
        const [supplier] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.vendorId, payment.partyId));
        const group = supplier?.supplierGroupId
          ? (
              await tx
                .select()
                .from(supplierGroups)
                .where(
                  eq(supplierGroups.supplierGroupId, supplier.supplierGroupId),
                )
            )[0]
          : null;

        earlyPaymentDiscount = new Decimal(
          supplier?.earlyPaymentDiscount ?? group?.earlyPaymentDiscount ?? '0',
        );
        earlyPaymentDiscountDays =
          supplier?.earlyPaymentDiscountDays ??
          group?.earlyPaymentDiscountDays ??
          0;
      }

      // Batch lock all target documents per reference type
      const salesInvoiceIds = Array.from(
        new Set(
          dto.allocations
            .filter((a) => a.referenceType === 'sales_invoice')
            .map((a) => a.referenceId),
        ),
      );
      const purchaseInvoiceIds = Array.from(
        new Set(
          dto.allocations
            .filter((a) => a.referenceType === 'purchase_invoice')
            .map((a) => a.referenceId),
        ),
      );
      const salesCreditNoteIds = Array.from(
        new Set(
          dto.allocations
            .filter((a) => a.referenceType === 'sales_credit_note')
            .map((a) => a.referenceId),
        ),
      );
      const purchaseDebitNoteIds = Array.from(
        new Set(
          dto.allocations
            .filter((a) => a.referenceType === 'purchase_debit_note')
            .map((a) => a.referenceId),
        ),
      );

      const docMap = new Map<string, AllocatableDoc>();

      if (salesInvoiceIds.length > 0) {
        const rows = (await tx
          .select()
          .from(salesInvoices)
          .where(inArray(salesInvoices.invoiceId, salesInvoiceIds))
          .for('update')) as AllocatableDoc[];
        for (const r of rows) {
          if (r.invoiceId) docMap.set(`sales_invoice:${r.invoiceId}`, r);
        }
      }
      if (purchaseInvoiceIds.length > 0) {
        const rows = (await tx
          .select()
          .from(purchaseInvoices)
          .where(inArray(purchaseInvoices.invoiceId, purchaseInvoiceIds))
          .for('update')) as AllocatableDoc[];
        for (const r of rows) {
          if (r.invoiceId) docMap.set(`purchase_invoice:${r.invoiceId}`, r);
        }
      }
      if (salesCreditNoteIds.length > 0) {
        const rows = (await tx
          .select()
          .from(salesCreditNotes)
          .where(inArray(salesCreditNotes.creditNoteId, salesCreditNoteIds))
          .for('update')) as AllocatableDoc[];
        for (const r of rows) {
          if (r.creditNoteId)
            docMap.set(`sales_credit_note:${r.creditNoteId}`, r);
        }
      }
      if (purchaseDebitNoteIds.length > 0) {
        const rows = (await tx
          .select()
          .from(purchaseDebitNotes)
          .where(inArray(purchaseDebitNotes.debitNoteId, purchaseDebitNoteIds))
          .for('update')) as AllocatableDoc[];
        for (const r of rows) {
          if (r.debitNoteId)
            docMap.set(`purchase_debit_note:${r.debitNoteId}`, r);
        }
      }

      // Sum other draft allocations across all referenced documents in a single query
      const allRefIds = Array.from(
        new Set(dto.allocations.map((a) => a.referenceId)),
      );
      const otherDrafts =
        allRefIds.length > 0
          ? await tx
              .select({
                referenceId: paymentAllocations.referenceId,
                allocated: paymentAllocations.allocatedAmount,
              })
              .from(paymentAllocations)
              .innerJoin(
                paymentEntries,
                eq(paymentAllocations.paymentId, paymentEntries.paymentId),
              )
              .where(
                and(
                  inArray(paymentAllocations.referenceId, allRefIds),
                  eq(paymentEntries.stateCode, PAYMENT_STATE.DRAFT),
                  sql`${paymentAllocations.paymentId} != ${paymentId}`,
                ),
              )
          : [];

      const otherDraftAllocatedMap = new Map<string, Decimal>();
      for (const d of otherDrafts) {
        if (!d.referenceId) continue;
        const curr =
          otherDraftAllocatedMap.get(d.referenceId) || new Decimal(0);
        otherDraftAllocatedMap.set(
          d.referenceId,
          curr.plus(new Decimal(d.allocated || '0')),
        );
      }

      // Process each allocation
      for (const alloc of dto.allocations) {
        let targetIdLabel: string;
        let draftState: string;
        let cancelledState: string;

        switch (alloc.referenceType) {
          case 'sales_invoice':
            targetIdLabel = 'invoice';
            draftState = SALES_INVOICE_STATE.DRAFT;
            cancelledState = SALES_INVOICE_STATE.CANCELLED;
            break;
          case 'purchase_invoice':
            targetIdLabel = 'invoice';
            draftState = PURCHASE_INVOICE_STATE.DRAFT;
            cancelledState = PURCHASE_INVOICE_STATE.CANCELLED;
            break;
          case 'sales_credit_note':
            targetIdLabel = 'credit note';
            draftState = SALES_CREDIT_NOTE_STATE.DRAFT;
            cancelledState = SALES_CREDIT_NOTE_STATE.CANCELLED;
            break;
          case 'purchase_debit_note':
            targetIdLabel = 'debit note';
            draftState = PURCHASE_DEBIT_NOTE_STATE.DRAFT;
            cancelledState = PURCHASE_DEBIT_NOTE_STATE.CANCELLED;
            break;
          default:
            throw new BadRequestException(
              `Unknown referenceType: ${String(alloc.referenceType)}`,
            );
        }

        const doc = docMap.get(`${alloc.referenceType}:${alloc.referenceId}`);

        if (!doc)
          throw new NotFoundException(
            `${targetIdLabel} ${alloc.referenceId} not found`,
          );

        if (doc.stateCode === draftState || doc.stateCode === cancelledState) {
          throw new BadRequestException(
            `Cannot allocate to ${targetIdLabel} in state ${doc.stateCode}`,
          );
        }

        const otherDraftAllocated =
          otherDraftAllocatedMap.get(alloc.referenceId) || new Decimal(0);
        const outstanding = new Decimal(doc.outstandingAmount || '0');
        const allocAmountDec = new Decimal(alloc.allocatedAmount || '0');
        const requestedDiscount = new Decimal(alloc.discountAmount || '0');

        if (
          allocAmountDec
            .plus(requestedDiscount)
            .greaterThan(outstanding.minus(otherDraftAllocated).plus(0.001))
        ) {
          throw new BadRequestException(
            `Cannot allocate more than remaining outstanding amount on ${targetIdLabel} (Outstanding: ${outstanding.toString()}, Pending in other drafts: ${otherDraftAllocated.toString()})`,
          );
        }

        if (requestedDiscount.greaterThan(0)) {
          if (!doc.invoiceDate) {
            throw new BadRequestException(
              `Cannot calculate discount: ${targetIdLabel} ${alloc.referenceId} has no invoice date.`,
            );
          }

          if (
            allocAmountDec
              .plus(requestedDiscount)
              .lessThan(outstanding.minus(otherDraftAllocated).minus(0.001))
          ) {
            throw new BadRequestException(
              `Discount is only applicable if the payment fully settles the remaining outstanding balance.`,
            );
          }

          const invoiceDate = new Date(doc.invoiceDate);
          const paymentDate = new Date(payment.paymentDate);

          const diffTime = Math.abs(
            paymentDate.getTime() - invoiceDate.getTime(),
          );
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          if (diffDays > earlyPaymentDiscountDays) {
            throw new BadRequestException(
              `Payment date (${String(payment.paymentDate)}) is past the allowed early payment discount period (${earlyPaymentDiscountDays} days from invoice date).`,
            );
          }

          // Use totalAmount of the invoice for max discount calculation, as discount is usually based on full invoice amount
          const docTotal = new Decimal(doc.totalAmount || '0');
          const maxDiscount = docTotal.mul(earlyPaymentDiscount).div(100);

          if (requestedDiscount.greaterThan(maxDiscount.plus(0.001))) {
            throw new BadRequestException(
              `Requested discount (${requestedDiscount.toString()}) exceeds allowable discount (${maxDiscount.toString()}) based on terms.`,
            );
          }
        }

        // 3. Create allocation record (does NOT decrement outstandingAmount yet)
        await tx.insert(paymentAllocations).values({
          paymentId,
          referenceType: alloc.referenceType,
          referenceId: alloc.referenceId,
          allocatedAmount: alloc.allocatedAmount.toString(),
          discountAmount: alloc.discountAmount
            ? alloc.discountAmount.toString()
            : null,
        });

        unallocatedAmount = unallocatedAmount.minus(allocAmountDec);
      }

      // Update payment unallocated amount
      const [updatedPayment] = await tx
        .update(paymentEntries)
        .set({
          unallocatedAmount: unallocatedAmount.toFixed(2),
          modifiedOn: new Date(),
        })
        .where(eq(paymentEntries.paymentId, paymentId))
        .returning();

      // If SUBMITTED, we must apply these new allocations immediately and post the GL entries
      if (
        payment.stateCode === PAYMENT_STATE.SUBMITTED &&
        dto.allocations.length > 0
      ) {
        const newAllocations = dto.allocations.map((a) => ({
          ...a,
          allocationId: randomUUID(), // Dummy ID to satisfy applyAllocationsType if needed
        }));

        await this._applyAllocationsToInvoices(
          tx,
          paymentId,
          payment,
          newAllocations,
          actor,
        );

        await this._postLateAllocationJournal(
          tx,
          payment,
          newAllocations,
          actor,
        );
      }

      return updatedPayment;
    });
  }

  async _applyAllocationsToInvoices(
    tx: DrizzleDB,
    paymentId: string,
    payment: typeof paymentEntries.$inferSelect,
    allocations: {
      allocationId?: string;
      referenceType: string;
      referenceId: string;
      allocatedAmount: string | number;
      discountAmount?: string | number | null;
    }[],
    actor: string,
  ) {
    // Batch lock all target documents per reference type
    const salesInvoiceIds = Array.from(
      new Set(
        allocations
          .filter((a) => a.referenceType === 'sales_invoice')
          .map((a) => a.referenceId),
      ),
    );
    const purchaseInvoiceIds = Array.from(
      new Set(
        allocations
          .filter((a) => a.referenceType === 'purchase_invoice')
          .map((a) => a.referenceId),
      ),
    );
    const salesCreditNoteIds = Array.from(
      new Set(
        allocations
          .filter((a) => a.referenceType === 'sales_credit_note')
          .map((a) => a.referenceId),
      ),
    );
    const purchaseDebitNoteIds = Array.from(
      new Set(
        allocations
          .filter((a) => a.referenceType === 'purchase_debit_note')
          .map((a) => a.referenceId),
      ),
    );

    const docMap = new Map<string, AllocatableDoc>();

    if (salesInvoiceIds.length > 0) {
      const rows = (await tx
        .select()
        .from(salesInvoices)
        .where(inArray(salesInvoices.invoiceId, salesInvoiceIds))
        .for('update')) as AllocatableDoc[];
      for (const r of rows) {
        if (r.invoiceId) docMap.set(`sales_invoice:${r.invoiceId}`, r);
      }
    }
    if (purchaseInvoiceIds.length > 0) {
      const rows = (await tx
        .select()
        .from(purchaseInvoices)
        .where(inArray(purchaseInvoices.invoiceId, purchaseInvoiceIds))
        .for('update')) as AllocatableDoc[];
      for (const r of rows) {
        if (r.invoiceId) docMap.set(`purchase_invoice:${r.invoiceId}`, r);
      }
    }
    if (salesCreditNoteIds.length > 0) {
      const rows = (await tx
        .select()
        .from(salesCreditNotes)
        .where(inArray(salesCreditNotes.creditNoteId, salesCreditNoteIds))
        .for('update')) as AllocatableDoc[];
      for (const r of rows) {
        if (r.creditNoteId)
          docMap.set(`sales_credit_note:${r.creditNoteId}`, r);
      }
    }
    if (purchaseDebitNoteIds.length > 0) {
      const rows = (await tx
        .select()
        .from(purchaseDebitNotes)
        .where(inArray(purchaseDebitNotes.debitNoteId, purchaseDebitNoteIds))
        .for('update')) as AllocatableDoc[];
      for (const r of rows) {
        if (r.debitNoteId)
          docMap.set(`purchase_debit_note:${r.debitNoteId}`, r);
      }
    }

    for (const alloc of allocations) {
      let targetTable: PgTable | null = null;
      let targetIdCol: AnyPgColumn | null = null;

      switch (alloc.referenceType) {
        case 'sales_invoice':
          targetTable = salesInvoices;
          targetIdCol = salesInvoices.invoiceId;
          break;
        case 'purchase_invoice':
          targetTable = purchaseInvoices;
          targetIdCol = purchaseInvoices.invoiceId;
          break;
        case 'sales_credit_note':
          targetTable = salesCreditNotes;
          targetIdCol = salesCreditNotes.creditNoteId;
          break;
        case 'purchase_debit_note':
          targetTable = purchaseDebitNotes;
          targetIdCol = purchaseDebitNotes.debitNoteId;
          break;
      }

      if (targetTable && targetIdCol) {
        const doc = docMap.get(`${alloc.referenceType}:${alloc.referenceId}`);

        if (doc) {
          const outstanding = new Decimal(doc.outstandingAmount || '0');
          const discountAmt = new Decimal(alloc.discountAmount || '0');
          const allocAmt = new Decimal(alloc.allocatedAmount || '0');
          const newOutstanding = outstanding.minus(allocAmt).minus(discountAmt);

          // Update in-memory doc in case multiple allocations touch the same document
          doc.outstandingAmount = newOutstanding.toFixed(2);

          await tx
            .update(targetTable)
            .set({
              outstandingAmount: newOutstanding.toFixed(2),
              modifiedOn: new Date(),
            })
            .where(eq(targetIdCol, alloc.referenceId));

          // Evaluate Invoice Lifecycle
          if (alloc.referenceType === 'sales_invoice') {
            await evaluateSalesInvoiceLifecycleRules(
              tx,
              alloc.referenceId,
              { entity: 'payment', id: paymentId, action: 'allocated' },
              actor,
            );
          } else if (alloc.referenceType === 'purchase_invoice') {
            await evaluatePurchaseInvoiceLifecycleRules(
              tx,
              alloc.referenceId,
              { entity: 'payment', id: paymentId, action: 'allocated' },
              actor,
            );
          }

          // Emit allocation event
          await emitEvent(tx, {
            entityType: EntityType.PAYMENT,
            entityId: paymentId,
            eventType: EventType.PAYMENT_ALLOCATED,
            entityDisplayName: payment.paymentNumber,
            payload: {
              allocationId: alloc.allocationId,
              referenceType: alloc.referenceType,
              referenceId: alloc.referenceId,
              allocatedAmount: alloc.allocatedAmount,
              newOutstandingBalance: newOutstanding.toNumber(),
            },
            actor,
          });

          // Also emit to the invoice event stream
          const entityDisplayName =
            doc.invoiceNumber ||
            doc.creditNoteNumber ||
            doc.debitNoteNumber ||
            alloc.referenceId;
          // @sync-ignore -- Entity type is resolved dynamically at runtime but will match valid types
          await emitEvent(tx, {
            entityType: alloc.referenceType as EntityTypeValue,
            entityId: alloc.referenceId,
            eventType: EventType.PAYMENT_ALLOCATED,
            entityDisplayName,
            payload: {
              paymentId: paymentId,
              paymentNumber: payment.paymentNumber,
              allocationId: alloc.allocationId,
              allocatedAmount: alloc.allocatedAmount,
              newOutstandingBalance: newOutstanding.toNumber(),
            },
            actor,
          });
        }
      }
    }
  }

  async _postLateAllocationJournal(
    tx: DrizzleDB,
    payment: typeof paymentEntries.$inferSelect,
    allocations: {
      allocationId?: string;
      referenceType: string;
      referenceId: string;
      allocatedAmount: string | number;
      discountAmount?: string | number | null;
    }[],
    actor: string,
  ) {
    if (!allocations.length) return;

    const paymentRateDec = new Decimal(payment.exchangeRate || '1');
    const isReceipt = (
      [
        PAYMENT_TYPE.CUSTOMER_RECEIPT,
        PAYMENT_TYPE.SUPPLIER_REFUND,
        PAYMENT_TYPE.DIRECT_RECEIPT,
      ] as PaymentType[]
    ).includes(payment.paymentType as PaymentType);
    const settings = await this.glService.getSettings(tx);

    let controlAccountId: string | null = null;
    let linePartyType: 'customer' | 'supplier' | null = null;
    if (
      payment.paymentType === PAYMENT_TYPE.CUSTOMER_RECEIPT ||
      payment.paymentType === PAYMENT_TYPE.CUSTOMER_REFUND
    ) {
      if (payment.partyId) {
        const [custRow] = await tx
          .select({
            defaultArAccountId: customerGroups.defaultArAccountId,
          })
          .from(customers)
          .leftJoin(
            customerGroups,
            eq(customers.customerGroupId, customerGroups.customerGroupId),
          )
          .where(eq(customers.customerId, payment.partyId));
        controlAccountId =
          custRow?.defaultArAccountId || settings?.defaultArAccountId || null;
        linePartyType = 'customer';
      }
    } else if (
      payment.paymentType === PAYMENT_TYPE.SUPPLIER_PAYMENT ||
      payment.paymentType === PAYMENT_TYPE.SUPPLIER_REFUND
    ) {
      if (payment.partyId) {
        const [suppRow] = await tx
          .select({
            defaultApAccountId: supplierGroups.defaultApAccountId,
          })
          .from(suppliers)
          .leftJoin(
            supplierGroups,
            eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
          )
          .where(eq(suppliers.vendorId, payment.partyId));
        controlAccountId =
          suppRow?.defaultApAccountId || settings?.defaultApAccountId || null;
        linePartyType = 'supplier';
      }
    }

    if (!controlAccountId) return;

    const fxGainAccountId = settings?.realisedFxGainAccountId || null;
    const fxLossAccountId = settings?.realisedFxLossAccountId || null;
    const discountGivenAccountId =
      settings?.defaultDiscountsGivenAccountId || null;
    const discountReceivedAccountId =
      settings?.defaultDiscountsReceivedAccountId || null;
    const discountAccountId = isReceipt
      ? discountGivenAccountId
      : discountReceivedAccountId;

    const salesInvoiceIds = Array.from(
      new Set(
        allocations
          .filter((a) => a.referenceType === 'sales_invoice')
          .map((a) => a.referenceId),
      ),
    );
    const purchaseInvoiceIds = Array.from(
      new Set(
        allocations
          .filter((a) => a.referenceType === 'purchase_invoice')
          .map((a) => a.referenceId),
      ),
    );

    const exchangeRateMap = new Map<string, Decimal>();

    if (salesInvoiceIds.length > 0) {
      const salesInvs = await tx
        .select({
          invoiceId: salesInvoices.invoiceId,
          exchangeRate: salesInvoices.exchangeRate,
        })
        .from(salesInvoices)
        .where(inArray(salesInvoices.invoiceId, salesInvoiceIds));

      for (const inv of salesInvs) {
        if (inv.exchangeRate) {
          exchangeRateMap.set(inv.invoiceId, new Decimal(inv.exchangeRate));
        }
      }
    }

    if (purchaseInvoiceIds.length > 0) {
      const purchaseInvs = await tx
        .select({
          invoiceId: purchaseInvoices.invoiceId,
          exchangeRate: purchaseInvoices.exchangeRate,
        })
        .from(purchaseInvoices)
        .where(inArray(purchaseInvoices.invoiceId, purchaseInvoiceIds));

      for (const inv of purchaseInvs) {
        if (inv.exchangeRate) {
          exchangeRateMap.set(inv.invoiceId, new Decimal(inv.exchangeRate));
        }
      }
    }

    const lines: JournalLineDto[] = [];
    let totalDebits = new Decimal(0);
    let totalCredits = new Decimal(0);

    for (const alloc of allocations) {
      const invoiceRateDec =
        exchangeRateMap.get(alloc.referenceId) || paymentRateDec;

      const allocAmtDec = new Decimal(alloc.allocatedAmount || '0');
      const discountAmtDec = new Decimal(alloc.discountAmount || '0');

      const allocInvoiceBaseDec = allocAmtDec
        .mul(invoiceRateDec)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const allocPaymentBaseDec = allocAmtDec
        .mul(paymentRateDec)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
      const discountBaseDec = discountAmtDec
        .mul(invoiceRateDec)
        .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

      // Unallocated was posted at paymentRate, invoice is posted at invoiceRate.
      // We must reverse the unallocated portion from AR, and post it + discount at invoice rate.
      if (isReceipt) {
        // Receipt: original unallocated was Credited to AR at paymentRate.
        // We must Debit AR for (allocPaymentBase), Credit AR for (allocInvoiceBase + discountBase)
        // Delta Credit to AR = allocInvoiceBase + discountBase - allocPaymentBase
        const deltaCreditARDec = allocInvoiceBaseDec
          .plus(discountBaseDec)
          .minus(allocPaymentBaseDec);

        if (discountAmtDec.greaterThan(0) && discountAccountId) {
          lines.push({
            accountId: discountAccountId,
            debit: discountBaseDec.toNumber(),
            credit: 0,
            foreignDebit: discountAmtDec.toNumber(),
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: invoiceRateDec.toNumber(),
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Early Payment Discount for ${payment.paymentNumber}`,
          });
          totalDebits = totalDebits.plus(discountBaseDec);
        }

        if (deltaCreditARDec.greaterThan(0)) {
          lines.push({
            accountId: controlAccountId,
            debit: 0,
            credit: deltaCreditARDec.toNumber(),
            foreignDebit: 0,
            foreignCredit: discountAmtDec.toNumber(),
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalCredits = totalCredits.plus(deltaCreditARDec);
        } else if (deltaCreditARDec.lessThan(0)) {
          const debitARDec = deltaCreditARDec.negated();
          lines.push({
            accountId: controlAccountId,
            debit: debitARDec.toNumber(),
            credit: 0,
            foreignDebit: 0,
            foreignCredit: discountAmtDec.negated().toNumber(), // negative foreign credit is essentially a foreign debit of discountAmt
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalDebits = totalDebits.plus(debitARDec);
        }
      } else {
        // Payment: original unallocated was Debited to AP at paymentRate.
        // We must Credit AP for (allocPaymentBase), Debit AP for (allocInvoiceBase + discountBase)
        // Delta Debit to AP = allocInvoiceBase + discountBase - allocPaymentBase
        const deltaDebitAPDec = allocInvoiceBaseDec
          .plus(discountBaseDec)
          .minus(allocPaymentBaseDec);

        if (discountAmtDec.greaterThan(0) && discountAccountId) {
          lines.push({
            accountId: discountAccountId,
            debit: 0,
            credit: discountBaseDec.toNumber(),
            foreignDebit: 0,
            foreignCredit: discountAmtDec.toNumber(),
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: invoiceRateDec.toNumber(),
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Early Payment Discount for ${payment.paymentNumber}`,
          });
          totalCredits = totalCredits.plus(discountBaseDec);
        }

        if (deltaDebitAPDec.greaterThan(0)) {
          lines.push({
            accountId: controlAccountId,
            debit: deltaDebitAPDec.toNumber(),
            credit: 0,
            foreignDebit: discountAmtDec.toNumber(),
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalDebits = totalDebits.plus(deltaDebitAPDec);
        } else if (deltaDebitAPDec.lessThan(0)) {
          const creditAPDec = deltaDebitAPDec.negated();
          lines.push({
            accountId: controlAccountId,
            debit: 0,
            credit: creditAPDec.toNumber(),
            foreignDebit: discountAmtDec.negated().toNumber(),
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalCredits = totalCredits.plus(creditAPDec);
        }
      }
    }

    const fxVarianceDec = totalDebits.minus(totalCredits);
    if (fxVarianceDec.abs().greaterThan(0.0001)) {
      if (!fxGainAccountId || !fxLossAccountId) {
        throw new BadRequestException(
          'Realised FX Gain/Loss accounts are not configured in GL Settings.',
        );
      }
      if (fxVarianceDec.greaterThan(0)) {
        lines.push({
          accountId: fxGainAccountId,
          debit: 0,
          credit: fxVarianceDec.toNumber(),
          foreignDebit: 0,
          foreignCredit: 0,
          foreignCurrencyCode: payment.currencyCode,
          exchangeRate: 1,
          memo: `Realised FX Gain for ${payment.paymentNumber}`,
        });
      } else {
        lines.push({
          accountId: fxLossAccountId,
          debit: fxVarianceDec.abs().toNumber(),
          credit: 0,
          foreignDebit: 0,
          foreignCredit: 0,
          foreignCurrencyCode: payment.currencyCode,
          exchangeRate: 1,
          memo: `Realised FX Loss for ${payment.paymentNumber}`,
        });
      }
    }

    if (lines.length > 0) {
      await this.glService.postJournalEntry(
        lines,
        {
          sourceId: payment.paymentId,
          sourceType: JOURNAL_ENTRY_SOURCE_TYPE.PAYMENT_ENTRY,
          memo: `Late Allocation for ${payment.paymentNumber}`,
          entryDate: new Date().toISOString().split('T')[0],
          actor,
        },
        tx,
      );
    }
  }
}
