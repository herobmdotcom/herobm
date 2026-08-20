import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, and, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  paymentEntries,
  paymentAllocations,
  salesInvoices,
  purchaseInvoices,
  customers,
  customerGroups,
  suppliers,
  supplierGroups,
  paymentLines,
  salesCreditNotes,
  purchaseDebitNotes,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { getExchangeRateForCurrency } from '../common/fx-helper';
import { GlService } from '../gl/gl.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { evaluateSalesInvoiceLifecycleRules } from '../invoices/sales-invoice-lifecycle-rules';
import { evaluatePurchaseInvoiceLifecycleRules } from '../invoices/purchase-invoice-lifecycle-rules';
import { CreatePaymentDto } from './dto';
import { JournalLineDto } from '../gl/dto';
import { PAYMENT_STATE, PAYMENT_TYPE } from '@herobm/shared';
import { PaymentsCoreService } from './payments-core.service';
import { PaymentsPostingService } from './payments-posting.service';

@Injectable()
export class PaymentsWriteService {
  private readonly logger = new Logger(PaymentsWriteService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly suppliersService: SuppliersService,
    @Inject(forwardRef(() => PaymentsCoreService))
    private readonly paymentsCoreService: PaymentsCoreService,
    @Inject(forwardRef(() => PaymentsPostingService))
    private readonly paymentsPostingService: PaymentsPostingService,
  ) {}

  async createPaymentEntry(dto: CreatePaymentDto, actor: string) {
    return await this.db.transaction(async (tx) => {
      const paymentNumber =
        await this.paymentsCoreService.generatePaymentNumber(
          tx as unknown as DrizzleDB,
        );

      // JIT Compliance Block for Payments
      if (dto.paymentType?.startsWith('supplier_') && dto.partyId) {
        const risk = await this.suppliersService.assessRisk(
          dto.partyId,
          tx as DrizzleDB,
        );
        if (risk.isPaymentBlocked) {
          throw new BadRequestException(
            `Supplier is blocked for payment. Reasons: ${risk.paymentBlockReasons.join(', ')}`,
          );
        }
      }

      const fx = await getExchangeRateForCurrency(
        tx as DrizzleDB,
        dto.currencyCode,
        new Date(dto.paymentDate),
      );
      const baseAmount = (
        parseFloat(dto.totalAmount?.toString() || '0') * fx.rate
      ).toFixed(2);

      let initialUnallocated = parseFloat(dto.totalAmount?.toString() || '0');
      let baseInitialUnallocated = parseFloat(baseAmount);

      if (dto.allocations && dto.allocations.length > 0) {
        for (const alloc of dto.allocations) {
          const allocAmt = parseFloat(alloc.allocatedAmount.toString() || '0');
          initialUnallocated -= allocAmt;
          baseInitialUnallocated -= allocAmt * fx.rate;
        }
      }

      const [payment] = await tx
        .insert(paymentEntries)
        .values({
          paymentId: dto.paymentId,
          paymentNumber,
          paymentType: dto.paymentType,
          partyId: dto.partyId || null,
          paymentDate: new Date(dto.paymentDate),
          modeOfPayment: dto.modeOfPayment,
          totalAmount: dto.totalAmount?.toString() || '0',
          unallocatedAmount: initialUnallocated.toString(),
          baseTotalAmount: baseAmount,
          baseUnallocatedAmount: baseInitialUnallocated.toFixed(2),
          glAccountBank: dto.glAccountBank,
          referenceNumber: dto.referenceNumber,
          currencyCode: dto.currencyCode,
          exchangeRate: fx.rate.toString(),
          createdBy: actor,
          stateCode: PAYMENT_STATE.DRAFT,
        })
        .returning();

      if (dto.lines && dto.lines.length > 0) {
        await tx.insert(paymentLines).values(
          dto.lines.map((line) => ({
            paymentId: payment.paymentId,
            glAccountId: line.accountId,
            amount: line.amount.toString(),
            memo: line.memo || null,
          })),
        );
      }

      if (dto.allocations && dto.allocations.length > 0) {
        await tx.insert(paymentAllocations).values(
          dto.allocations.map((alloc) => ({
            paymentId: payment.paymentId,
            referenceType: alloc.referenceType,
            referenceId: alloc.referenceId,
            allocatedAmount: alloc.allocatedAmount.toString(),
            discountAmount: alloc.discountAmount?.toString() || '0',
          })),
        );
      }

      if (dto.submitImmediately) {
        return await this.paymentsPostingService.submitPaymentEntry(
          payment.paymentId,
          actor,
          tx as unknown as DrizzleDB,
        );
      }

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PAYMENT,
        entityId: payment.paymentId,
        eventType: EventType.CREATED,
        entityDisplayName: payment.paymentNumber,
        payload: payment,
      });

      return payment;
    });
  }

  // @herobm-skip-audit
  async removePayment(paymentId: string) {
    return await this.db.transaction(async (tx) => {
      const [payment] = await tx
        .select()
        .from(paymentEntries)
        .where(eq(paymentEntries.paymentId, paymentId))
        .for('update');

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      if (payment.stateCode !== PAYMENT_STATE.DRAFT) {
        throw new BadRequestException(
          'Only draft payments can be permanently deleted. Submitted or Posted payments must be cancelled.',
        );
      }

      await tx
        .delete(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      await tx
        .delete(paymentLines)
        .where(eq(paymentLines.paymentId, paymentId));

      await tx
        .delete(paymentEntries)
        .where(eq(paymentEntries.paymentId, paymentId));

      return { success: true };
    });
  }

  async cancelPayment(paymentId: string, actor: string) {
    return await this.db.transaction(async (tx) => {
      // 1. Lock payment
      const [payment] = await tx
        .select()
        .from(paymentEntries)
        .where(eq(paymentEntries.paymentId, paymentId))
        .for('update');

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      if (payment.stateCode !== PAYMENT_STATE.SUBMITTED) {
        throw new BadRequestException(
          'Only submitted payments can be cancelled',
        );
      }

      // 2. Revert allocations
      const allocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      for (const alloc of allocations) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
        let targetTable: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries where exact types are unknown.
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
            const newOutstanding =
              outstanding + parseFloat(alloc.allocatedAmount);

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
                { entity: 'payment', id: paymentId, action: 'cancelled' },
                actor,
              );
            } else if (alloc.referenceType === 'purchase_invoice') {
              await evaluatePurchaseInvoiceLifecycleRules(
                tx as unknown as DrizzleDB,
                alloc.referenceId,
                { entity: 'payment', id: paymentId, action: 'cancelled' },
                actor,
              );
            }
          }
        }
      }

      // 3. Reverse the GL journal entry
      const amount = parseFloat(payment.totalAmount);

      // Resolve Payment Lines (Split) vs Control Customer (AR/AP/Direct)
      const payLines = await tx
        .select()
        .from(paymentLines)
        .where(eq(paymentLines.paymentId, paymentId));

      let controlAccountId: string | null = null;
      let linePartyType: 'customer' | 'supplier' | null = null;

      if (payment.paymentType.startsWith('customer_'))
        linePartyType = 'customer';
      if (payment.paymentType.startsWith('supplier_'))
        linePartyType = 'supplier';

      if (payLines.length === 0) {
        if (linePartyType === 'customer') {
          const [custRow] = await tx
            .select({
              defaultArAccountId: customerGroups.defaultArAccountId,
            })
            .from(customers)
            .leftJoin(
              customerGroups,
              eq(customers.customerGroupId, customerGroups.customerGroupId),
            )
            .where(eq(customers.customerId, payment.partyId!));
          controlAccountId = custRow?.defaultArAccountId || null;
        } else if (linePartyType === 'supplier') {
          const [suppRow] = await tx
            .select({
              defaultApAccountId: supplierGroups.defaultApAccountId,
            })
            .from(suppliers)
            .leftJoin(
              supplierGroups,
              eq(suppliers.supplierGroupId, supplierGroups.supplierGroupId),
            )
            .where(eq(suppliers.vendorId, payment.partyId!));
          controlAccountId = suppRow?.defaultApAccountId || null;
        } else if (payment.paymentType.startsWith('direct_')) {
          controlAccountId = payment.partyId;
        }

        if (!controlAccountId && !payment.paymentType.startsWith('direct_')) {
          const settings = await this.glService.getSettings(tx);
          controlAccountId =
            linePartyType === 'customer'
              ? settings?.defaultArAccountId || null
              : settings?.defaultApAccountId || null;
        }

        if (!controlAccountId) {
          throw new BadRequestException(
            `Could not resolve control account for reversal.`,
          );
        }
      }

      // Reverse: swap debit/credit from original
      const reversalLines: JournalLineDto[] = [];
      const linePartyId =
        (linePartyType ? payment.partyId : undefined) ?? undefined;
      const isReceipt = (
        [
          PAYMENT_TYPE.CUSTOMER_RECEIPT,
          PAYMENT_TYPE.SUPPLIER_REFUND,
          PAYMENT_TYPE.DIRECT_RECEIPT,
        ] as string[]
      ).includes(payment.paymentType);

      if (isReceipt) {
        reversalLines.push({
          accountId: payment.glAccountBank,
          debit: 0,
          credit: amount,
          memo: `Reversal: ${payment.paymentNumber}`,
        });

        if (payLines.length > 0) {
          reversalLines.push(
            ...payLines.map((pl) => {
              const plAmount = parseFloat(pl.amount);
              return {
                accountId: pl.glAccountId,
                debit: plAmount > 0 ? plAmount : 0,
                credit: plAmount < 0 ? Math.abs(plAmount) : 0,
                memo: `Reversal: ${pl.memo || payment.paymentNumber}`,
                partyType: linePartyType,
                partyId: linePartyId,
              };
            }),
          );
        } else {
          reversalLines.push({
            accountId: controlAccountId ?? undefined,
            debit: amount,
            credit: 0,
            memo: `Reversal: ${payment.paymentNumber}`,
            partyType: linePartyType,
            partyId: linePartyId,
          });
        }
      } else {
        reversalLines.push({
          accountId: payment.glAccountBank,
          debit: amount,
          credit: 0,
          memo: `Reversal: ${payment.paymentNumber}`,
        });

        if (payLines.length > 0) {
          reversalLines.push(
            ...payLines.map((pl) => {
              const plAmount = parseFloat(pl.amount);
              return {
                accountId: pl.glAccountId,
                debit: plAmount < 0 ? Math.abs(plAmount) : 0,
                credit: plAmount > 0 ? plAmount : 0,
                memo: `Reversal: ${pl.memo || payment.paymentNumber}`,
                partyType: linePartyType,
                partyId: linePartyId,
              };
            }),
          );
        } else {
          reversalLines.push({
            accountId: controlAccountId ?? undefined,
            debit: 0,
            credit: amount,
            memo: `Reversal: ${payment.paymentNumber}`,
            partyType: linePartyType,
            partyId: linePartyId,
          });
        }
      }

      await this.glService.postJournalEntry(
        reversalLines,
        {
          sourceId: payment.paymentId,
          sourceType: 'payment_entry',
          memo: `Cancellation of ${payment.paymentNumber}`,
          entryDate: new Date().toISOString().slice(0, 10),
          actor,
        },
        tx,
      );

      // 4. Update state
      const updated = await this.paymentsCoreService.changePaymentState(
        paymentId,
        PAYMENT_STATE.CANCELLED,
        actor,
        tx,
      );

      await emitEvent(tx as unknown as DrizzleDB, {
        entityType: EntityType.PAYMENT,
        entityId: paymentId,
        eventType: EventType.PAYMENT_CANCELLED,
        entityDisplayName: payment.paymentNumber,
        payload: { paymentId },
        actor,
      });

      return updated;
    });
  }
}
