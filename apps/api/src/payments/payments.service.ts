import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { eq, sql, and, gte } from 'drizzle-orm';
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
  glAccounts,
  paymentLines,
  salesCreditNotes,
  purchaseDebitNotes,
} from '../drizzle/modbm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { evaluateInvoiceLifecycleRules } from '../invoices/invoice-lifecycle-rules';
import { CreatePaymentDto, AllocatePaymentDto } from './dto';
import { AbaGeneratorService } from './aba-generator.service';
import { NachaGeneratorService } from './nacha-generator.service';
import { inArray } from 'drizzle-orm';
import {
  PAYMENT_STATE,
  PAYMENT_TRANSITIONS,
  SALES_INVOICE_STATE,
  PURCHASE_INVOICE_STATE,
  SALES_CREDIT_NOTE_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  getValidStates,
} from '@modbm/shared';
import type { PaymentState } from '@modbm/shared';

const VALID_PAYMENT_STATES = getValidStates(PAYMENT_TRANSITIONS);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly abaGenerator: AbaGeneratorService,
    private readonly nachaGenerator: NachaGeneratorService,
  ) {}

  // -------------------------------------------------------------------------
  // Payment number generation: PAY-YYYYMMDD-NNNN
  // -------------------------------------------------------------------------

  private async generatePaymentNumber(
    queryDb: DrizzleDB = this.db,
  ): Promise<string> {
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

  async findAll(days?: string, allocation?: string) {
    const whereClauses: any[] = [];

    if (days && days !== '0') {
      const dateLimit = new Date();
      dateLimit.setDate(dateLimit.getDate() - parseInt(days, 10));
      whereClauses.push(gte(paymentEntries.paymentDate, dateLimit));
    }

    if (allocation === 'unallocated') {
      whereClauses.push(sql`${paymentEntries.unallocatedAmount} > 0`);
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
        partyName: sql<string>`COALESCE(${customers.name}, ${suppliers.name})`,
      })
      .from(paymentEntries)
      .leftJoin(customers, eq(paymentEntries.partyId, customers.customerId))
      .leftJoin(suppliers, eq(paymentEntries.partyId, suppliers.vendorId))
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
        partyName: sql<string>`COALESCE(${customers.name}, ${suppliers.name})`,
      })
      .from(paymentEntries)
      .leftJoin(customers, eq(paymentEntries.partyId, customers.customerId))
      .leftJoin(suppliers, eq(paymentEntries.partyId, suppliers.vendorId))
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

  async createPaymentEntry(dto: CreatePaymentDto, actor: string) {
    return await this.db.transaction(async (tx) => {
      const paymentNumber = await this.generatePaymentNumber(tx as any);

      const [payment] = await tx
        .insert(paymentEntries)
        .values({
          paymentId: dto.paymentId,
          paymentNumber,
          paymentType: dto.paymentType,
          partyId: dto.partyId || null,
          paymentDate: new Date(dto.paymentDate),
          modeOfPayment: dto.modeOfPayment,
          totalAmount: dto.totalAmount.toString(),
          unallocatedAmount: dto.totalAmount.toString(),
          glAccountBank: dto.glAccountBank,
          referenceNumber: dto.referenceNumber,
          currencyCode: dto.currencyCode,
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

      if (dto.submitImmediately) {
        return await this.submitPaymentEntry(
          payment.paymentId,
          actor,
          tx as any,
        );
      }

      return payment;
    });
  }

  async submitPaymentEntry(
    paymentId: string,
    actor: string,
    providedTx?: DrizzleDB,
  ) {
    const execute = async (tx: DrizzleDB) => {
      // 1. Lock and validate payment
      const [payment] = await tx
        .select()
        .from(paymentEntries)
        .where(eq(paymentEntries.paymentId, paymentId))
        .for('update');

      if (!payment) {
        throw new NotFoundException(`Payment ${paymentId} not found`);
      }

      if (
        payment.stateCode !== PAYMENT_STATE.DRAFT &&
        payment.stateCode !== PAYMENT_STATE.EXPORTED
      ) {
        throw new BadRequestException(
          `Only draft or exported payments can be submitted`,
        );
      }

      // 2. Resolve Payment Lines (Split) vs Control Customer (AR/AP/Direct)
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
        // Fallback to existing single header-level offset logic
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

        // Fallback to global settings if not found on group
        if (!controlAccountId && !payment.paymentType.startsWith('direct_')) {
          const settings = await this.glService.getSettings(tx);
          controlAccountId =
            linePartyType === 'customer'
              ? settings?.defaultArAccountId || null
              : settings?.defaultApAccountId || null;
        }

        if (!controlAccountId) {
          throw new BadRequestException(
            `Could not resolve ${payment.paymentType} control account. Please check Party Group or GL Settings.`,
          );
        }
      }

      // 3. Post GL Journal Entry
      const amount = parseFloat(payment.totalAmount);
      const lines: any[] = [];

      const linePartyId = linePartyType ? payment.partyId : null;
      const isReceipt = [
        'customer_receipt',
        'supplier_refund',
        'direct_receipt',
      ].includes(payment.paymentType);

      if (isReceipt) {
        // Receipt: Debit Bank, Credit Offset (AR / Direct)
        lines.push({
          accountId: payment.glAccountBank,
          debit: amount,
          credit: 0,
          memo: `Payment ${payment.paymentNumber}`,
        });

        if (payLines.length > 0) {
          lines.push(
            ...payLines.map((pl) => {
              const plAmount = parseFloat(pl.amount);
              return {
                accountId: pl.glAccountId,
                debit: plAmount < 0 ? Math.abs(plAmount) : 0, // Handle negative lines like PAYG
                credit: plAmount > 0 ? plAmount : 0,
                memo: pl.memo || `Payment ${payment.paymentNumber}`,
                partyType: linePartyType,
                partyId: linePartyId,
              };
            }),
          );
        } else {
          lines.push({
            accountId: controlAccountId,
            debit: 0,
            credit: amount,
            memo: `Payment ${payment.paymentNumber}`,
            partyType: linePartyType,
            partyId: linePartyId,
          });
        }
      } else {
        // Payment: Credit Bank, Debit Offset (AP / Direct)
        lines.push({
          accountId: payment.glAccountBank,
          debit: 0,
          credit: amount,
          memo: `Payment ${payment.paymentNumber}`,
        });

        if (payLines.length > 0) {
          lines.push(
            ...payLines.map((pl) => {
              const plAmount = parseFloat(pl.amount);
              return {
                accountId: pl.glAccountId,
                debit: plAmount > 0 ? plAmount : 0,
                credit: plAmount < 0 ? Math.abs(plAmount) : 0, // Handle negative lines like PAYG
                memo: pl.memo || `Payment ${payment.paymentNumber}`,
                partyType: linePartyType,
                partyId: linePartyId,
              };
            }),
          );
        } else {
          lines.push({
            accountId: controlAccountId,
            debit: amount,
            credit: 0,
            memo: `Payment ${payment.paymentNumber}`,
            partyType: linePartyType,
            partyId: linePartyId,
          });
        }
      }

      await this.glService.postJournalEntry(
        lines,
        {
          sourceId: payment.paymentId,
          sourceType: 'payment_entry',
          memo: `Payment ${payment.paymentNumber}`,
          entryDate: payment.paymentDate.toISOString().split('T')[0],
        },
        tx,
      );

      // 6. Update state
      const updated = await this.changePaymentState(
        paymentId,
        PAYMENT_STATE.SUBMITTED,
        actor,
        tx,
      );

      return updated;
    };

    if (providedTx) {
      return await execute(providedTx);
    } else {
      return await this.db.transaction(async (tx) => {
        return await execute(tx);
      });
    }
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
      if (payment.stateCode !== PAYMENT_STATE.SUBMITTED)
        throw new BadRequestException(
          `Payment must be ${PAYMENT_STATE.SUBMITTED} to allocate`,
        );

      let unallocatedAmount = parseFloat(payment.unallocatedAmount);

      // Calculate total allocation requested
      const totalRequested = dto.allocations.reduce(
        (sum, a) => sum + a.allocatedAmount,
        0,
      );
      if (totalRequested > unallocatedAmount + 0.001) {
        throw new BadRequestException(
          `Cannot allocate more than the unallocated amount (${unallocatedAmount})`,
        );
      }

      // Process each allocation
      for (const alloc of dto.allocations) {
        let targetTable: any;
        let targetIdCol: any;
        let targetIdLabel: string;
        let draftState: string;
        let cancelledState: string;
        const targetStateCodeCol: string = 'stateCode';

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

        const outstanding = parseFloat(doc.outstandingAmount);
        if (alloc.allocatedAmount > outstanding + 0.001) {
          throw new BadRequestException(
            `Cannot allocate more than outstanding amount on ${targetIdLabel}`,
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
          .update(targetTable)
          .set({
            outstandingAmount: newOutstanding.toString(),
            modifiedOn: new Date(),
          })
          .where(eq(targetIdCol, alloc.referenceId));

        unallocatedAmount -= alloc.allocatedAmount;

        // 5. Evaluate Invoice Lifecycle (only for invoices)
        if (alloc.referenceType.endsWith('_invoice')) {
          await evaluateInvoiceLifecycleRules(
            tx as any,
            alloc.referenceType === 'sales_invoice' ? 'sales' : 'purchase',
            alloc.referenceId,
            { entity: 'payment', id: paymentId, action: 'allocated' },
            actor,
          );
        }

        // 6. Emit allocation event
        await emitEvent(tx as any, {
          entityType: EntityType.PAYMENT,
          entityId: paymentId,
          eventType: EventType.PAYMENT_ALLOCATED,
          entityDisplayName: payment.paymentNumber,
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

      // 2. Check for existing allocations
      const existingAllocations = await tx
        .select({ allocationId: paymentAllocations.allocationId })
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      if (existingAllocations.length > 0) {
        throw new BadRequestException(
          'Cannot cancel a payment that has allocations. Remove allocations first.',
        );
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
      const reversalLines: any[] = [];
      const linePartyId = linePartyType ? payment.partyId : null;
      const isReceipt = [
        'customer_receipt',
        'supplier_refund',
        'direct_receipt',
      ].includes(payment.paymentType);

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
            accountId: controlAccountId,
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
            accountId: controlAccountId,
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
        },
        tx,
      );

      // 4. Update state
      const updated = await this.changePaymentState(
        paymentId,
        PAYMENT_STATE.CANCELLED,
        actor,
        tx,
      );

      return updated;
    });
  }

  async exportAba(paymentIds: string[], actor: string): Promise<string> {
    return await this.db.transaction(async (tx) => {
      // 1. Fetch payments and their payee bank details
      const payments = await tx
        .select({
          paymentId: paymentEntries.paymentId,
          totalAmount: paymentEntries.totalAmount,
          stateCode: paymentEntries.stateCode,
          paymentNumber: paymentEntries.paymentNumber,
          glAccountBank: paymentEntries.glAccountBank,
          customerBankName: customers.bankAccountName,
          customerBsb: customers.bankBsb,
          customerAccount: customers.bankAccountNumber,
          supplierBankName: suppliers.bankAccountName,
          supplierBsb: suppliers.bankBsb,
          supplierAccount: suppliers.bankAccountNumber,
        })
        .from(paymentEntries)
        .leftJoin(customers, eq(paymentEntries.partyId, customers.customerId))
        .leftJoin(suppliers, eq(paymentEntries.partyId, suppliers.vendorId))
        .where(inArray(paymentEntries.paymentId, paymentIds));

      if (payments.length === 0) {
        throw new BadRequestException('No payments found to export');
      }

      // Check states
      for (const p of payments) {
        if (p.stateCode !== PAYMENT_STATE.DRAFT) {
          throw new BadRequestException(
            `Payment ${p.paymentNumber} is not in DRAFT state`,
          );
        }
      }

      // 2. Determine the company bank account
      const bankAccountId = payments[0].glAccountBank;
      if (!bankAccountId)
        throw new BadRequestException('No GL Account Bank set on payment');

      const [bankGl] = await tx
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, bankAccountId));

      if (!bankGl) throw new NotFoundException('GL Account Bank not found');

      const meta = (bankGl.metadata || {}) as any;
      if (!meta.abaUserName || !meta.abaUserId || !meta.bankName) {
        throw new BadRequestException(
          'Company Bank GL Account metadata is missing ABA details (abaUserName, abaUserId, bankName)',
        );
      }

      // 3. Build transactions
      const transactions = payments.map((p) => {
        const bsb = p.supplierBsb || p.customerBsb;
        const account = p.supplierAccount || p.customerAccount;
        const name = p.supplierBankName || p.customerBankName;

        if (!bsb || !account || !name) {
          throw new BadRequestException(
            `Missing bank details for payee on payment ${p.paymentNumber}`,
          );
        }

        return {
          bsb,
          accountNumber: account,
          accountName: name,
          amount: parseFloat(p.totalAmount),
          traceBsb: meta.bsb || '000-000',
          traceAccountNumber: meta.accountNumber || '000000',
          remitterName: meta.abaUserName,
          reference: p.paymentNumber,
        };
      });

      const d = new Date();
      const processDate =
        String(d.getDate()).padStart(2, '0') +
        String(d.getMonth() + 1).padStart(2, '0') +
        String(d.getFullYear()).slice(2, 4);

      // 4. Generate ABA file content
      const abaContent = this.abaGenerator.generateAbaFile({
        bankName: meta.bankName,
        abaUserName: meta.abaUserName,
        abaUserId: meta.abaUserId,
        description: 'PAYMENTS',
        processDate,
        transactions,
      });

      // 5. Update payments state
      for (const p of payments) {
        await this.changePaymentState(
          p.paymentId,
          PAYMENT_STATE.EXPORTED,
          actor,
          tx as any,
        );

        await tx
          .update(paymentEntries)
          .set({
            abaExportedAt: new Date(),
            modifiedOn: new Date(),
          })
          .where(eq(paymentEntries.paymentId, p.paymentId));
      }

      return abaContent;
    });
  }

  async exportNacha(paymentIds: string[], actor: string): Promise<string> {
    return await this.db.transaction(async (tx) => {
      // 1. Fetch payments and their payee bank details
      const payments = await tx
        .select({
          paymentId: paymentEntries.paymentId,
          totalAmount: paymentEntries.totalAmount,
          stateCode: paymentEntries.stateCode,
          paymentNumber: paymentEntries.paymentNumber,
          glAccountBank: paymentEntries.glAccountBank,
          customerBankName: customers.bankAccountName,
          customerRouting: customers.bankBsb, // BSB acts as Routing for US
          customerAccount: customers.bankAccountNumber,
          supplierBankName: suppliers.bankAccountName,
          supplierRouting: suppliers.bankBsb,
          supplierAccount: suppliers.bankAccountNumber,
        })
        .from(paymentEntries)
        .leftJoin(customers, eq(paymentEntries.partyId, customers.customerId))
        .leftJoin(suppliers, eq(paymentEntries.partyId, suppliers.vendorId))
        .where(inArray(paymentEntries.paymentId, paymentIds));

      if (payments.length === 0) {
        throw new BadRequestException('No payments found to export');
      }

      // Check states
      for (const p of payments) {
        if (p.stateCode !== PAYMENT_STATE.DRAFT) {
          throw new BadRequestException(
            `Payment ${p.paymentNumber} is not in DRAFT state`,
          );
        }
      }

      // 2. Determine the company bank account
      const bankAccountId = payments[0].glAccountBank;
      if (!bankAccountId)
        throw new BadRequestException('No GL Account Bank set on payment');

      const [bankGl] = await tx
        .select()
        .from(glAccounts)
        .where(eq(glAccounts.glAccountId, bankAccountId));

      if (!bankGl) throw new NotFoundException('GL Account Bank not found');

      const meta = (bankGl.metadata || {}) as any;
      if (
        !meta.companyId ||
        !meta.immediateDestination ||
        !meta.companyName ||
        !meta.immediateDestinationName
      ) {
        throw new BadRequestException(
          'Company Bank GL Account metadata is missing NACHA details (companyId, companyName, immediateDestination, immediateDestinationName)',
        );
      }

      // 3. Build transactions
      const transactions = payments.map((p) => {
        const routing = p.supplierRouting || p.customerRouting;
        const account = p.supplierAccount || p.customerAccount;
        const name = p.supplierBankName || p.customerBankName;

        if (!routing || !account || !name) {
          throw new BadRequestException(
            `Missing bank details for payee on payment ${p.paymentNumber}. Make sure routing number (bank bsb field) and account number are set.`,
          );
        }

        return {
          routingNumber: routing,
          accountNumber: account,
          accountName: name,
          amount: parseFloat(p.totalAmount),
          reference: p.paymentNumber,
        };
      });

      // 4. Generate NACHA file content
      const nachaContent = this.nachaGenerator.generateNachaFile({
        companyName: meta.companyName,
        companyId: meta.companyId,
        immediateDestination: meta.immediateDestination,
        immediateDestinationName: meta.immediateDestinationName,
        description: 'PAYMENTS',
        processDate: new Date(),
        transactions,
      });

      // 5. Update payments state
      for (const p of payments) {
        await this.changePaymentState(
          p.paymentId,
          PAYMENT_STATE.EXPORTED,
          actor,
          tx as any,
        );

        await tx
          .update(paymentEntries)
          .set({
            abaExportedAt: new Date(), // Reusing this timestamp for batch export
            modifiedOn: new Date(),
          })
          .where(eq(paymentEntries.paymentId, p.paymentId));
      }

      return nachaContent;
    });
  }

  async confirmExported(paymentIds: string[], actor: string) {
    for (const pid of paymentIds) {
      await this.submitPaymentEntry(pid, actor);
    }
  }

  async rejectExported(paymentIds: string[], actor: string) {
    return await this.db.transaction(async (tx) => {
      for (const pid of paymentIds) {
        await this.changePaymentState(pid, PAYMENT_STATE.DRAFT, actor, tx);
      }
    });
  }

  /**
   * Universal changeState for Payments
   */
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

    await emitEvent(tx as any, {
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
