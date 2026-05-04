import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  paymentEntries,
  paymentAllocations,
  salesInvoices,
  purchaseInvoices,
  glAccounts,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { AggregateType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { evaluateInvoiceLifecycleRules } from '../invoices/invoice-lifecycle-rules';
import { CreatePaymentDto, AllocatePaymentDto } from './dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  async findAll() {
    const data = await this.db
      .select()
      .from(paymentEntries)
      .orderBy(paymentEntries.createdOn);
    return { data };
  }

  async findOne(paymentId: string) {
    const [payment] = await this.db
      .select()
      .from(paymentEntries)
      .where(eq(paymentEntries.paymentId, paymentId));

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const allocations = await this.db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, paymentId));

    return { ...payment, allocations };
  }

  async createPaymentEntry(dto: CreatePaymentDto, actor: string) {
    // Generate a simple payment number
    const paymentNumber = `PAY-${Date.now()}`;

    const [payment] = await this.db
      .insert(paymentEntries)
      .values({
        paymentNumber,
        paymentType: dto.paymentType,
        partyType: dto.partyType,
        partyId: dto.partyId,
        paymentDate: new Date(dto.paymentDate),
        modeOfPayment: dto.modeOfPayment,
        totalAmount: dto.totalAmount.toString(),
        unallocatedAmount: dto.totalAmount.toString(),
        glAccountBank: dto.glAccountBank,
        referenceNumber: dto.referenceNumber,
        currencyCode: dto.currencyCode,
        createdBy: actor,
      })
      .returning();

    return payment;
  }

  async submitPaymentEntry(paymentId: string, actor: string) {
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

      if (payment.stateCode !== 'draft') {
        throw new BadRequestException('Only draft payments can be submitted');
      }

      // 2. Fetch Control Accounts (simplified AR/AP fetching for MVP)
      // Ideally this comes from appSettings or party settings. We'll find a generic AR/AP account.
      const accountType =
        payment.partyType === 'customer' ? 'asset' : 'liability'; // AR is asset, AP is liability

      const [controlAccount] = await tx
        .select()
        .from(glAccounts)
        .where(
          sql`LOWER(${glAccounts.name}) LIKE ${payment.partyType === 'customer' ? '%receivable%' : '%payable%'}`,
        )
        .limit(1);

      if (!controlAccount) {
        throw new BadRequestException(
          `Could not resolve control account for party type ${payment.partyType}`,
        );
      }

      // 3. Prepare GL Lines
      const amount = parseFloat(payment.totalAmount);
      let lines = [];

      if (payment.paymentType === 'receive') {
        // Receipt: Debit Bank, Credit AR
        lines = [
          { accountId: payment.glAccountBank, debit: amount, credit: 0 },
          { accountId: controlAccount.glAccountId, debit: 0, credit: amount },
        ];
      } else {
        // Payment: Debit AP, Credit Bank
        lines = [
          { accountId: controlAccount.glAccountId, debit: amount, credit: 0 },
          { accountId: payment.glAccountBank, debit: 0, credit: amount },
        ];
      }

      // 4. Post Journal (Strict Atomic via tx)
      await this.glService.postJournalEntry(
        lines,
        {
          sourceId: payment.paymentId,
          sourceType: 'payment_entry',
          memo: `Payment ${payment.paymentNumber}`,
          entryDate: payment.paymentDate
            ? payment.paymentDate.toISOString()
            : undefined,
        },
        tx,
      );

      // 5. Update State
      const [updated] = await tx
        .update(paymentEntries)
        .set({ stateCode: 'submitted', modifiedOn: new Date() })
        .where(eq(paymentEntries.paymentId, paymentId))
        .returning();

      // 6. Emit Outbox Event
      await emitEvent(tx as any, {
        aggregateType: AggregateType.PAYMENT,
        aggregateId: paymentId,
        eventType: EventType.PAYMENT_SUBMITTED,
        payload: {
          totalAmount: updated.totalAmount,
          modeOfPayment: updated.modeOfPayment,
          glAccountBank: updated.glAccountBank,
        },
        actor,
      });

      return updated;
    });
  }

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
      if (payment.stateCode !== 'submitted')
        throw new BadRequestException('Payment must be submitted to allocate');

      let unallocatedAmount = parseFloat(payment.unallocatedAmount);

      // Calculate total allocation requested
      const totalRequested = dto.allocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0,
      );
      if (totalRequested > unallocatedAmount) {
        throw new BadRequestException(
          `Cannot allocate more than the unallocated amount (${unallocatedAmount})`,
        );
      }

      // Process each allocation
      for (const alloc of dto.allocations) {
        const targetTable =
          alloc.referenceType === 'sales_invoice'
            ? salesInvoices
            : purchaseInvoices;
        const targetIdCol =
          alloc.referenceType === 'sales_invoice'
            ? salesInvoices.invoiceId
            : purchaseInvoices.invoiceId;

        // 2. Lock invoice
        const [invoice] = await tx
          .select()
          .from(targetTable)
          .where(eq(targetIdCol, alloc.referenceId))
          .for('update');

        if (!invoice)
          throw new NotFoundException(`Invoice ${alloc.referenceId} not found`);
        if (
          invoice.stateCode === 'draft' ||
          invoice.stateCode === 'cancelled'
        ) {
          throw new BadRequestException(
            `Cannot allocate to invoice in state ${invoice.stateCode}`,
          );
        }

        const outstanding = parseFloat(invoice.outstandingAmount);
        if (alloc.allocatedAmount > outstanding) {
          throw new BadRequestException(
            `Cannot allocate more than outstanding amount on invoice ${invoice.invoiceNumber}`,
          );
        }

        // 3. Create allocation record
        const [allocationRecord] = await tx
          .insert(paymentAllocations)
          .values({
            paymentId,
            referenceType: alloc.referenceType,
            referenceId: alloc.referenceId,
            allocatedAmount: alloc.allocatedAmount.toString(),
          })
          .returning();

        // 4. Decrement balances
        const newOutstanding = outstanding - alloc.allocatedAmount;
        await tx
          .update(targetTable as any)
          .set({
            outstandingAmount: newOutstanding.toString(),
            modifiedOn: new Date(),
          })
          .where(eq(targetIdCol, alloc.referenceId));

        unallocatedAmount -= alloc.allocatedAmount;

        // 5. Evaluate Invoice Lifecycle
        await evaluateInvoiceLifecycleRules(
          tx as any,
          alloc.referenceType === 'sales_invoice' ? 'sales' : 'purchase',
          alloc.referenceId,
          { entity: 'payment', id: paymentId, action: 'allocated' },
          actor,
        );

        // 6. Emit allocation event
        await emitEvent(tx as any, {
          aggregateType: AggregateType.PAYMENT,
          aggregateId: paymentId,
          eventType: EventType.PAYMENT_ALLOCATED,
          payload: {
            allocationId: allocationRecord.allocationId,
            referenceType: alloc.referenceType,
            referenceId: alloc.referenceId,
            allocatedAmount: alloc.allocatedAmount,
            newOutstandingBalance: newOutstanding,
          },
          actor,
        });
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

      return updatedPayment;
    });
  }
}
