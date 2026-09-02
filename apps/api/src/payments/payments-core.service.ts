import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, and, gte, SQL, or } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  paymentEntries,
  paymentAllocations,
  salesInvoices,
  purchaseInvoices,
  customers,
  suppliers,
  glAccounts,
  paymentLines,
  actors,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { PAYMENT_TRANSITIONS, getValidStates } from '@herobm/shared';
import type { PaymentState } from '@herobm/shared';

const VALID_PAYMENT_STATES = getValidStates(PAYMENT_TRANSITIONS);

@Injectable()
export class PaymentsCoreService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async generatePaymentNumber(queryDb: DrizzleDB = this.db): Promise<string> {
    const today = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `PAY-${today}-`;

    const result = await queryDb
      .select({ paymentNumber: paymentEntries.paymentNumber })
      .from(paymentEntries)
      .where(sql`${paymentEntries.paymentNumber} LIKE ${prefix + '%'}`)
      .orderBy(sql`${paymentEntries.paymentNumber} DESC`)
      .limit(1);

    let nextNumber = 1;
    if (result.length > 0 && result[0].paymentNumber) {
      const lastNumberStr = result[0].paymentNumber.split('-').pop();
      if (lastNumberStr) {
        nextNumber = parseInt(lastNumberStr, 10) + 1;
      }
    }

    return `${prefix}${nextNumber.toString().padStart(4, '0')}`;
  }

  async findAll(days?: string, allocation?: string, partyId?: string) {
    const whereClauses: SQL[] = [];

    if (days && days !== '0') {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - parseInt(days, 10));
      whereClauses.push(gte(paymentEntries.paymentDate, dateLimit));
    }

    if (allocation === 'unallocated') {
      whereClauses.push(sql`${paymentEntries.unallocatedAmount} > 0`);
    }

    if (partyId) {
      whereClauses.push(eq(paymentEntries.partyId, partyId));
    }

    const whereClause =
      whereClauses.length > 0 ? and(...whereClauses) : undefined;

    const data = await this.db
      .select({
        paymentId: paymentEntries.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentType: paymentEntries.paymentType,
        partyId: paymentEntries.partyId,
        paymentDate: paymentEntries.paymentDate,
        modeOfPayment: paymentEntries.modeOfPayment,
        totalAmount: paymentEntries.totalAmount,
        unallocatedAmount: paymentEntries.unallocatedAmount,
        stateCode: paymentEntries.stateCode,
        currencyCode: paymentEntries.currencyCode,
        createdOn: paymentEntries.createdOn,
        createdBy: paymentEntries.createdBy,
        partyName: actors.name,
      })
      .from(paymentEntries)
      .leftJoin(customers, eq(paymentEntries.partyId, customers.customerId))
      .leftJoin(suppliers, eq(paymentEntries.partyId, suppliers.vendorId))
      .leftJoin(
        actors,
        or(
          eq(customers.actorId, actors.actorId),
          eq(suppliers.actorId, actors.actorId),
        ),
      )
      .where(whereClause)
      .orderBy(sql`${paymentEntries.createdOn} DESC`);
    return { data };
  }

  async findOne(paymentId: string) {
    const [payment] = await this.db
      .select({
        paymentId: paymentEntries.paymentId,
        paymentNumber: paymentEntries.paymentNumber,
        paymentType: paymentEntries.paymentType,
        partyId: paymentEntries.partyId,
        paymentDate: paymentEntries.paymentDate,
        modeOfPayment: paymentEntries.modeOfPayment,
        totalAmount: paymentEntries.totalAmount,
        unallocatedAmount: paymentEntries.unallocatedAmount,
        stateCode: paymentEntries.stateCode,
        currencyCode: paymentEntries.currencyCode,
        glAccountBank: paymentEntries.glAccountBank,
        referenceNumber: paymentEntries.referenceNumber,
        createdOn: paymentEntries.createdOn,
        createdBy: paymentEntries.createdBy,
        partyName: actors.name,
      })
      .from(paymentEntries)
      .leftJoin(customers, eq(paymentEntries.partyId, customers.customerId))
      .leftJoin(suppliers, eq(paymentEntries.partyId, suppliers.vendorId))
      .leftJoin(
        actors,
        or(
          eq(customers.actorId, actors.actorId),
          eq(suppliers.actorId, actors.actorId),
        ),
      )
      .where(eq(paymentEntries.paymentId, paymentId));

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const allocations = await this.db
      .select({
        allocationId: paymentAllocations.allocationId,
        paymentId: paymentAllocations.paymentId,
        referenceType: paymentAllocations.referenceType,
        referenceId: paymentAllocations.referenceId,
        allocatedAmount: paymentAllocations.allocatedAmount,
        discountAmount: paymentAllocations.discountAmount,
        createdOn: paymentAllocations.createdOn,
        invoiceNumber: sql<string>`COALESCE(${salesInvoices.invoiceNumber}, ${purchaseInvoices.invoiceNumber})`,
      })
      .from(paymentAllocations)
      .leftJoin(
        salesInvoices,
        eq(paymentAllocations.referenceId, salesInvoices.invoiceId),
      )
      .leftJoin(
        purchaseInvoices,
        eq(paymentAllocations.referenceId, purchaseInvoices.invoiceId),
      )
      .where(eq(paymentAllocations.paymentId, paymentId));

    const lines = await this.db
      .select({
        accountId: paymentLines.glAccountId,
        amount: paymentLines.amount,
        memo: paymentLines.memo,
        accountName: glAccounts.name,
      })
      .from(paymentLines)
      .leftJoin(
        glAccounts,
        eq(paymentLines.glAccountId, glAccounts.glAccountId),
      )
      .where(eq(paymentLines.paymentId, paymentId));

    return { ...payment, allocations, lines };
  }

  async changePaymentState(
    paymentId: string,
    newState: PaymentState,
    actor: string,
    tx: DrizzleDB,
  ) {
    if (!VALID_PAYMENT_STATES.includes(newState)) {
      throw new BadRequestException(`Invalid payment state: '${newState}'`);
    }

    const [payment] = await tx
      .select({
        stateCode: paymentEntries.stateCode,
        paymentNumber: paymentEntries.paymentNumber,
        totalAmount: paymentEntries.totalAmount,
        modeOfPayment: paymentEntries.modeOfPayment,
        glAccountBank: paymentEntries.glAccountBank,
      })
      .from(paymentEntries)
      .where(eq(paymentEntries.paymentId, paymentId));

    if (!payment) {
      throw new NotFoundException(`Payment ${paymentId} not found`);
    }

    const allowed = PAYMENT_TRANSITIONS[payment.stateCode];
    if (!allowed || !allowed.includes(newState)) {
      throw new BadRequestException(
        `Cannot transition payment from '${payment.stateCode}' to '${newState}'. Allowed transitions: ${allowed?.join(', ') || 'none'}`,
      );
    }

    const [updated] = await tx
      .update(paymentEntries)
      .set({ stateCode: newState, modifiedOn: new Date() })
      .where(eq(paymentEntries.paymentId, paymentId))
      .returning();

    await emitEvent(tx as unknown as DrizzleDB, {
      entityType: EntityType.PAYMENT,
      entityId: paymentId,
      eventType: EventType.STATUS_CHANGED,
      entityDisplayName: payment.paymentNumber,
      payload: {
        entity: 'payment',
        entityId: paymentId,
        paymentNumber: payment.paymentNumber,
        totalAmount: payment.totalAmount,
        modeOfPayment: payment.modeOfPayment,
        glAccountBank: payment.glAccountBank,
        from: payment.stateCode,
        to: newState,
      },
      actor,
    });

    return updated;
  }
}
