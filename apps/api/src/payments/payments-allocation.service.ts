import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, and } from 'drizzle-orm';
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
import { EntityType, EventType } from '../common/event-types';
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

      let unallocatedAmount =
        payment.stateCode === PAYMENT_STATE.DRAFT
          ? parseFloat(payment.totalAmount)
          : parseFloat(payment.unallocatedAmount);

      // Calculate total allocation requested
      const totalRequested = dto.allocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0,
      );
      if (totalRequested > unallocatedAmount + 0.001) {
        throw new BadRequestException(
          `Cannot allocate more than the available unallocated amount (${unallocatedAmount})`,
        );
      }

      let earlyPaymentDiscount = 0;
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

        earlyPaymentDiscount = parseFloat(
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

        earlyPaymentDiscount = parseFloat(
          supplier?.earlyPaymentDiscount ?? group?.earlyPaymentDiscount ?? '0',
        );
        earlyPaymentDiscountDays =
          supplier?.earlyPaymentDiscountDays ??
          group?.earlyPaymentDiscountDays ??
          0;
      }

      // Process each allocation
      for (const alloc of dto.allocations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        let targetTable: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        let targetIdCol: any;
        let targetIdLabel: string;
        let draftState: string;
        let cancelledState: string;

        switch (alloc.referenceType) {
          case 'sales_invoice':
            targetTable = salesInvoices;
            targetIdCol = salesInvoices.invoiceId;
            targetIdLabel = 'invoice';
            draftState = SALES_INVOICE_STATE.DRAFT;
            cancelledState = SALES_INVOICE_STATE.CANCELLED;
            break;
          case 'purchase_invoice':
            targetTable = purchaseInvoices;
            targetIdCol = purchaseInvoices.invoiceId;
            targetIdLabel = 'invoice';
            draftState = PURCHASE_INVOICE_STATE.DRAFT;
            cancelledState = PURCHASE_INVOICE_STATE.CANCELLED;
            break;
          case 'sales_credit_note':
            targetTable = salesCreditNotes;
            targetIdCol = salesCreditNotes.creditNoteId;
            targetIdLabel = 'credit note';
            draftState = SALES_CREDIT_NOTE_STATE.DRAFT;
            cancelledState = SALES_CREDIT_NOTE_STATE.CANCELLED;
            break;
          case 'purchase_debit_note':
            targetTable = purchaseDebitNotes;
            targetIdCol = purchaseDebitNotes.debitNoteId;
            targetIdLabel = 'debit note';
            draftState = PURCHASE_DEBIT_NOTE_STATE.DRAFT;
            cancelledState = PURCHASE_DEBIT_NOTE_STATE.CANCELLED;
            break;
          default:
            throw new BadRequestException(
              `Unknown referenceType: ${String(alloc.referenceType)}`,
            );
        }

        // 2. Lock invoice/note
        const [doc] = await tx
          .select()
          .from(targetTable)
          .where(eq(targetIdCol, alloc.referenceId))
          .for('update');

        if (!doc)
          throw new NotFoundException(
            `${targetIdLabel} ${alloc.referenceId} not found`,
          );

        if (doc.stateCode === draftState || doc.stateCode === cancelledState) {
          throw new BadRequestException(
            `Cannot allocate to ${targetIdLabel} in state ${doc.stateCode}`,
          );
        }

        // Sum other draft allocations to prevent over-allocation across multiple drafts
        const otherDrafts = await tx
          .select({ allocated: paymentAllocations.allocatedAmount })
          .from(paymentAllocations)
          .innerJoin(
            paymentEntries,
            eq(paymentAllocations.paymentId, paymentEntries.paymentId),
          )
          .where(
            and(
              eq(paymentAllocations.referenceId, alloc.referenceId),
              eq(paymentEntries.stateCode, PAYMENT_STATE.DRAFT),
              // Exclude the current payment ID
              sql`${paymentAllocations.paymentId} != ${paymentId}`,
            ),
          );

        const otherDraftAllocated = otherDrafts.reduce(
          (sum, d) => sum + parseFloat(d.allocated),
          0,
        );
        const outstanding = parseFloat(doc.outstandingAmount);

        const requestedDiscount = alloc.discountAmount || 0;

        if (
          alloc.allocatedAmount + requestedDiscount >
          outstanding - otherDraftAllocated + 0.001
        ) {
          throw new BadRequestException(
            `Cannot allocate more than remaining outstanding amount on ${targetIdLabel} (Outstanding: ${outstanding}, Pending in other drafts: ${otherDraftAllocated})`,
          );
        }

        if (requestedDiscount > 0) {
          if (!doc.invoiceDate) {
            throw new BadRequestException(
              `Cannot calculate discount: ${targetIdLabel} ${alloc.referenceId} has no invoice date.`,
            );
          }

          if (
            alloc.allocatedAmount + requestedDiscount <
            outstanding - otherDraftAllocated - 0.001
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
          const docTotal = parseFloat(doc.totalAmount);
          const maxDiscount = (docTotal * earlyPaymentDiscount) / 100;

          if (requestedDiscount > maxDiscount + 0.001) {
            throw new BadRequestException(
              `Requested discount (${requestedDiscount}) exceeds allowable discount (${maxDiscount}) based on terms.`,
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

        unallocatedAmount -= alloc.allocatedAmount;
      }

      // Update payment unallocated amount
      const [updatedPayment] = await tx
        .update(paymentEntries)
        .set({
          unallocatedAmount: unallocatedAmount.toString(),
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
    tx: any,
    paymentId: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
    payment: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
    allocations: any[],
    actor: string,
  ) {
    for (const alloc of allocations) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
      let targetTable: any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
      let targetIdCol: any;

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

      if (targetTable) {
        const [doc] = await tx
          .select()
          .from(targetTable)
          .where(eq(targetIdCol, alloc.referenceId))
          .for('update');

        if (doc) {
          const outstanding = parseFloat(doc.outstandingAmount);
          const discountAmt = parseFloat(alloc.discountAmount || '0');
          const newOutstanding =
            outstanding - parseFloat(alloc.allocatedAmount) - discountAmt;

          await tx
            .update(targetTable)
            .set({
              outstandingAmount: newOutstanding.toString(),
              modifiedOn: new Date(),
            })
            .where(eq(targetIdCol, alloc.referenceId));

          // Evaluate Invoice Lifecycle
          if (alloc.referenceType === 'sales_invoice') {
            await evaluateSalesInvoiceLifecycleRules(
              tx as unknown as DrizzleDB,
              alloc.referenceId,
              { entity: 'payment', id: paymentId, action: 'allocated' },
              actor,
            );
          } else if (alloc.referenceType === 'purchase_invoice') {
            await evaluatePurchaseInvoiceLifecycleRules(
              tx as unknown as DrizzleDB,
              alloc.referenceId,
              { entity: 'payment', id: paymentId, action: 'allocated' },
              actor,
            );
          }

          // Emit allocation event
          await emitEvent(tx as unknown as DrizzleDB, {
            entityType: EntityType.PAYMENT,
            entityId: paymentId,
            eventType: EventType.PAYMENT_ALLOCATED,
            entityDisplayName: payment.paymentNumber,
            payload: {
              allocationId: alloc.allocationId,
              referenceType: alloc.referenceType,
              referenceId: alloc.referenceId,
              allocatedAmount: alloc.allocatedAmount,
              newOutstandingBalance: newOutstanding,
            },
            actor,
          });

          // Also emit to the invoice event stream
          // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic document table access
          const entityDisplayName =
            doc.invoiceNumber ||
            doc.creditNoteNumber ||
            doc.debitNoteNumber ||
            alloc.referenceId;
          // @sync-ignore -- Entity type is resolved dynamically at runtime but will match valid types
          await emitEvent(tx as unknown as DrizzleDB, {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Types align dynamically
            entityType: alloc.referenceType,
            entityId: alloc.referenceId,
            eventType: EventType.PAYMENT_ALLOCATED,
            entityDisplayName,
            payload: {
              paymentId: paymentId,
              paymentNumber: payment.paymentNumber,
              allocationId: alloc.allocationId,
              allocatedAmount: alloc.allocatedAmount,
              newOutstandingBalance: newOutstanding,
            },
            actor,
          });
        }
      }
    }
  }

  async _postLateAllocationJournal(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
    tx: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
    payment: any,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic target table
    allocations: any[],
    actor: string,
  ) {
    if (!allocations.length) return;

    const paymentRate = parseFloat(payment.exchangeRate || '1');
    const isReceipt = [
      PAYMENT_TYPE.CUSTOMER_RECEIPT,
      PAYMENT_TYPE.SUPPLIER_REFUND,
      PAYMENT_TYPE.DIRECT_RECEIPT,
    ].includes(payment.paymentType);
    const settings = await this.glService.getSettings(tx);

    let controlAccountId: string | null = null;
    let linePartyType: 'customer' | 'supplier' | null = null;
    if (
      payment.paymentType === PAYMENT_TYPE.CUSTOMER_RECEIPT ||
      payment.paymentType === PAYMENT_TYPE.CUSTOMER_REFUND
    ) {
      if (payment.partyId) {
        const [cust] = await tx
          .select()
          .from(customers)
          .where(eq(customers.customerId, payment.partyId));
        controlAccountId = cust?.glAccountReceivable ?? null;
        linePartyType = 'customer';
      }
    } else if (
      payment.paymentType === PAYMENT_TYPE.SUPPLIER_PAYMENT ||
      payment.paymentType === PAYMENT_TYPE.SUPPLIER_REFUND
    ) {
      if (payment.partyId) {
        const [sup] = await tx
          .select()
          .from(suppliers)
          .where(eq(suppliers.vendorId, payment.partyId));
        controlAccountId = sup?.glAccountPayable ?? null;
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

    const lines: JournalLineDto[] = [];
    let totalDebits = 0;
    let totalCredits = 0;

    for (const alloc of allocations) {
      let invoiceRate = paymentRate;
      if (alloc.referenceType === 'sales_invoice') {
        const [inv] = await tx
          .select({ exchangeRate: salesInvoices.exchangeRate })
          .from(salesInvoices)
          .where(eq(salesInvoices.invoiceId, alloc.referenceId));
        if (inv?.exchangeRate) invoiceRate = parseFloat(inv.exchangeRate);
      } else if (alloc.referenceType === 'purchase_invoice') {
        const [inv] = await tx
          .select({ exchangeRate: purchaseInvoices.exchangeRate })
          .from(purchaseInvoices)
          .where(eq(purchaseInvoices.invoiceId, alloc.referenceId));
        if (inv?.exchangeRate) invoiceRate = parseFloat(inv.exchangeRate);
      }

      const allocAmt = parseFloat(alloc.allocatedAmount || '0');
      const discountAmt = parseFloat(alloc.discountAmount || '0');

      const allocInvoiceBase = allocAmt * invoiceRate;
      const allocPaymentBase = allocAmt * paymentRate;
      const discountBase = discountAmt * invoiceRate;

      // Unallocated was posted at paymentRate, invoice is posted at invoiceRate.
      // We must reverse the unallocated portion from AR, and post it + discount at invoice rate.
      if (isReceipt) {
        // Receipt: original unallocated was Credited to AR at paymentRate.
        // We must Debit AR for (allocPaymentBase), Credit AR for (allocInvoiceBase + discountBase)
        // Delta Credit to AR = allocInvoiceBase + discountBase - allocPaymentBase
        const deltaCreditAR =
          allocInvoiceBase + discountBase - allocPaymentBase;

        if (discountAmt > 0 && discountAccountId) {
          lines.push({
            accountId: discountAccountId,
            debit: discountBase,
            credit: 0,
            foreignDebit: discountAmt,
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: invoiceRate,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Early Payment Discount for ${payment.paymentNumber}`,
          });
          totalDebits += discountBase;
        }

        if (deltaCreditAR > 0) {
          lines.push({
            accountId: controlAccountId,
            debit: 0,
            credit: deltaCreditAR,
            foreignDebit: 0,
            foreignCredit: discountAmt,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalCredits += deltaCreditAR;
        } else if (deltaCreditAR < 0) {
          const debitAR = -deltaCreditAR;
          lines.push({
            accountId: controlAccountId,
            debit: debitAR,
            credit: 0,
            foreignDebit: 0,
            foreignCredit: -discountAmt, // negative foreign credit is essentially a foreign debit of discountAmt
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalDebits += debitAR;
        }
      } else {
        // Payment: original unallocated was Debited to AP at paymentRate.
        // We must Credit AP for (allocPaymentBase), Debit AP for (allocInvoiceBase + discountBase)
        // Delta Debit to AP = allocInvoiceBase + discountBase - allocPaymentBase
        const deltaDebitAP = allocInvoiceBase + discountBase - allocPaymentBase;

        if (discountAmt > 0 && discountAccountId) {
          lines.push({
            accountId: discountAccountId,
            debit: 0,
            credit: discountBase,
            foreignDebit: 0,
            foreignCredit: discountAmt,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: invoiceRate,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Early Payment Discount for ${payment.paymentNumber}`,
          });
          totalCredits += discountBase;
        }

        if (deltaDebitAP > 0) {
          lines.push({
            accountId: controlAccountId,
            debit: deltaDebitAP,
            credit: 0,
            foreignDebit: discountAmt,
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalDebits += deltaDebitAP;
        } else if (deltaDebitAP < 0) {
          const creditAP = -deltaDebitAP;
          lines.push({
            accountId: controlAccountId,
            debit: 0,
            credit: creditAP,
            foreignDebit: -discountAmt,
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            partyType: linePartyType,
            partyId: payment.partyId,
            memo: `Late Allocation for ${payment.paymentNumber}`,
          });
          totalCredits += creditAP;
        }
      }
    }

    const fxVariance = totalDebits - totalCredits;
    if (Math.abs(fxVariance) > 0.005) {
      if (!fxGainAccountId || !fxLossAccountId) {
        throw new BadRequestException(
          'Realised FX Gain/Loss accounts are not configured in GL Settings.',
        );
      }
      if (fxVariance > 0) {
        lines.push({
          accountId: fxGainAccountId,
          debit: 0,
          credit: fxVariance,
          foreignDebit: 0,
          foreignCredit: 0,
          foreignCurrencyCode: payment.currencyCode,
          exchangeRate: 1,
          memo: `Realised FX Gain for ${payment.paymentNumber}`,
        });
      } else {
        lines.push({
          accountId: fxLossAccountId,
          debit: -fxVariance,
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
