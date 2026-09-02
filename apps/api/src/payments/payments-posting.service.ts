import {
  Injectable,
  Inject,
  forwardRef,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { eq, sql, and, inArray } from 'drizzle-orm';
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
  supplierExpiries,
} from '@herobm/db-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { GlService } from '../gl/gl.service';
import { JournalLineDto } from '../gl/dto';
import { AbaGeneratorService } from './aba-generator.service';
import { NachaGeneratorService } from './nacha-generator.service';
import { PaymentsCoreService } from './payments-core.service';
import { PaymentsAllocationService } from './payments-allocation.service';
import {
  PAYMENT_STATE,
  PAYMENT_TYPE,
  JOURNAL_ENTRY_SOURCE_TYPE,
} from '@herobm/shared';

@Injectable()
export class PaymentsPostingService {
  private readonly logger = new Logger(PaymentsPostingService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly abaGenerator: AbaGeneratorService,
    private readonly nachaGenerator: NachaGeneratorService,
    @Inject(forwardRef(() => PaymentsCoreService))
    private readonly paymentsCoreService: PaymentsCoreService,
    @Inject(forwardRef(() => PaymentsAllocationService))
    private readonly paymentsAllocationService: PaymentsAllocationService,
  ) {}

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

      // JIT Compliance Block for Payments
      if (payment.paymentType.startsWith('supplier_') && payment.partyId) {
        const expiredDocs = await tx
          .select({ id: supplierExpiries.expiryId })
          .from(supplierExpiries)
          .where(
            and(
              eq(supplierExpiries.vendorId, payment.partyId),
              sql`${supplierExpiries.expiryDate} < CURRENT_DATE`,
            ),
          )
          .limit(1);

        if (expiredDocs.length > 0) {
          throw new BadRequestException(
            'Supplier has expired compliance documentation. Cannot submit payment.',
          );
        }
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
      const amount = parseFloat(payment.totalAmount || '0');
      const paymentRate = parseFloat(payment.exchangeRate || '1');
      const baseAmount = payment.baseTotalAmount
        ? parseFloat(payment.baseTotalAmount)
        : amount * paymentRate;

      // Fetch allocations early to compute base equivalents at invoice rates
      const draftAllocations = await tx
        .select()
        .from(paymentAllocations)
        .where(eq(paymentAllocations.paymentId, paymentId));

      let totalDiscountForeign = 0;
      let totalAllocatedForeign = 0;
      let totalAllocatedBaseAtInvoiceRate = 0;
      let totalDiscountBaseAtInvoiceRate = 0;

      for (const alloc of draftAllocations) {
        const discountAmt = parseFloat(alloc.discountAmount || '0');
        const allocAmt = parseFloat(alloc.allocatedAmount || '0');
        totalDiscountForeign += discountAmt;
        totalAllocatedForeign += allocAmt;

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

        totalAllocatedBaseAtInvoiceRate += allocAmt * invoiceRate;
        totalDiscountBaseAtInvoiceRate += discountAmt * invoiceRate;
      }

      const unallocatedForeign = amount - totalAllocatedForeign;
      const unallocatedBase = unallocatedForeign * paymentRate;

      const totalControlBase =
        totalAllocatedBaseAtInvoiceRate + unallocatedBase;

      const isReceipt = (
        [
          PAYMENT_TYPE.CUSTOMER_RECEIPT,
          PAYMENT_TYPE.SUPPLIER_REFUND,
          PAYMENT_TYPE.DIRECT_RECEIPT,
        ] as string[]
      ).includes(payment.paymentType);

      const settings = await this.glService.getSettings(tx);

      let discountAccountId: string | null = null;
      if (totalDiscountForeign > 0) {
        discountAccountId = isReceipt
          ? settings?.defaultDiscountsGivenAccountId || null
          : settings?.defaultDiscountsReceivedAccountId || null;
        if (!discountAccountId) {
          throw new BadRequestException(
            `Early Payment Discount applies but no Default Discounts ${isReceipt ? 'Given' : 'Received'} Account is configured in GL Settings.`,
          );
        }
      }

      const fxGainAccountId = settings?.realisedFxGainAccountId || null;
      const fxLossAccountId = settings?.realisedFxLossAccountId || null;

      const lines: JournalLineDto[] = [];
      const linePartyId =
        (linePartyType ? payment.partyId : undefined) ?? undefined;

      let totalDebits = 0;
      let totalCredits = 0;

      if (isReceipt) {
        // Receipt: Debit Bank, Credit Offset (AR / Direct)
        lines.push({
          accountId: payment.glAccountBank,
          debit: baseAmount,
          credit: 0,
          foreignDebit: amount,
          foreignCredit: 0,
          foreignCurrencyCode: payment.currencyCode,
          exchangeRate: paymentRate,
          memo: `Payment ${payment.paymentNumber}`,
        });
        totalDebits += baseAmount;

        if (totalDiscountForeign > 0 && discountAccountId) {
          lines.push({
            accountId: discountAccountId,
            debit: totalDiscountBaseAtInvoiceRate,
            credit: 0,
            foreignDebit: totalDiscountForeign,
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: paymentRate, // It's an approximation for UI, the base amount matters more
            memo: `Early Payment Discount for ${payment.paymentNumber}`,
          });
          totalDebits += totalDiscountBaseAtInvoiceRate;
        }

        if (payLines.length > 0) {
          // Note: payLines currently don't use foreign currency logic in the schema, we assume they are base or at payment rate
          for (const pl of payLines) {
            const plAmount = parseFloat(pl.amount);
            const plBase = plAmount * paymentRate;
            const isDebit = plAmount < 0;
            const absPlBase = Math.abs(plBase);
            lines.push({
              accountId: pl.glAccountId,
              debit: isDebit ? absPlBase : 0,
              credit: !isDebit ? absPlBase : 0,
              foreignDebit: isDebit ? Math.abs(plAmount) : 0,
              foreignCredit: !isDebit ? Math.abs(plAmount) : 0,
              foreignCurrencyCode: payment.currencyCode,
              exchangeRate: paymentRate,
              memo: pl.memo || `Payment ${payment.paymentNumber}`,
              partyType: linePartyType,
              partyId: linePartyId,
            });
            if (isDebit) totalDebits += absPlBase;
            else totalCredits += absPlBase;
          }
        } else {
          lines.push({
            accountId: controlAccountId ?? undefined,
            debit: 0,
            credit: totalControlBase + totalDiscountBaseAtInvoiceRate,
            foreignDebit: 0,
            foreignCredit: amount + totalDiscountForeign,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: paymentRate,
            memo: `Payment ${payment.paymentNumber}`,
            partyType: linePartyType,
            partyId: linePartyId,
          });
          totalCredits += totalControlBase + totalDiscountBaseAtInvoiceRate;
        }
      } else {
        // Payment: Credit Bank, Debit Offset (AP / Direct)
        lines.push({
          accountId: payment.glAccountBank,
          debit: 0,
          credit: baseAmount,
          foreignDebit: 0,
          foreignCredit: amount,
          foreignCurrencyCode: payment.currencyCode,
          exchangeRate: paymentRate,
          memo: `Payment ${payment.paymentNumber}`,
        });
        totalCredits += baseAmount;

        if (totalDiscountForeign > 0 && discountAccountId) {
          lines.push({
            accountId: discountAccountId,
            debit: 0,
            credit: totalDiscountBaseAtInvoiceRate,
            foreignDebit: 0,
            foreignCredit: totalDiscountForeign,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: paymentRate,
            memo: `Early Payment Discount for ${payment.paymentNumber}`,
          });
          totalCredits += totalDiscountBaseAtInvoiceRate;
        }

        if (payLines.length > 0) {
          for (const pl of payLines) {
            const plAmount = parseFloat(pl.amount);
            const plBase = plAmount * paymentRate;
            const isDebit = plAmount > 0;
            const absPlBase = Math.abs(plBase);
            lines.push({
              accountId: pl.glAccountId,
              debit: isDebit ? absPlBase : 0,
              credit: !isDebit ? absPlBase : 0,
              foreignDebit: isDebit ? Math.abs(plAmount) : 0,
              foreignCredit: !isDebit ? Math.abs(plAmount) : 0,
              foreignCurrencyCode: payment.currencyCode,
              exchangeRate: paymentRate,
              memo: pl.memo || `Payment ${payment.paymentNumber}`,
              partyType: linePartyType,
              partyId: linePartyId,
            });
            if (isDebit) totalDebits += absPlBase;
            else totalCredits += absPlBase;
          }
        } else {
          lines.push({
            accountId: controlAccountId ?? undefined,
            debit: totalControlBase + totalDiscountBaseAtInvoiceRate,
            credit: 0,
            foreignDebit: amount + totalDiscountForeign,
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: paymentRate,
            memo: `Payment ${payment.paymentNumber}`,
            partyType: linePartyType,
            partyId: linePartyId,
          });
          totalDebits += totalControlBase + totalDiscountBaseAtInvoiceRate;
        }
      }

      // Calculate FX Variance
      const fxVariance = totalDebits - totalCredits;
      if (Math.abs(fxVariance) > 0.005) {
        if (!fxGainAccountId || !fxLossAccountId) {
          throw new BadRequestException(
            'Realised FX Gain/Loss accounts are not configured in GL Settings.',
          );
        }

        if (fxVariance > 0) {
          // Debits > Credits -> We need a Credit to balance -> FX Gain
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
          // Credits > Debits -> We need a Debit to balance -> FX Loss
          lines.push({
            accountId: fxLossAccountId,
            debit: Math.abs(fxVariance),
            credit: 0,
            foreignDebit: 0,
            foreignCredit: 0,
            foreignCurrencyCode: payment.currencyCode,
            exchangeRate: 1,
            memo: `Realised FX Loss for ${payment.paymentNumber}`,
          });
        }
      }

      if (!lines || lines.length < 2) {
        throw new BadRequestException(
          `Cannot post payment ${payment.paymentNumber}: Bank or Control Account is not configured in GL Settings (${lines.length} lines resolved).`,
        );
      }

      await this.glService.postJournalEntry(
        lines,
        {
          sourceId: payment.paymentId,
          sourceType: JOURNAL_ENTRY_SOURCE_TYPE.PAYMENT_ENTRY,
          memo: `Payment ${payment.paymentNumber}`,
          entryDate: payment.paymentDate.toISOString().split('T')[0],
          actor,
        },
        tx,
      );

      // Process allocations (decrement outstanding amounts and emit events)
      await this.paymentsAllocationService._applyAllocationsToInvoices(
        tx,
        paymentId,
        payment,
        draftAllocations,
        actor,
      );

      // 6. Update state
      const updated = await this.paymentsCoreService.changePaymentState(
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

      const meta = (bankGl.metadata || {}) as Record<string, string>;
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
        await this.paymentsCoreService.changePaymentState(
          p.paymentId,
          PAYMENT_STATE.EXPORTED,
          actor,
          tx as unknown as DrizzleDB,
        );

        await tx
          .update(paymentEntries)
          .set({
            abaExportedAt: new Date(),
            modifiedOn: new Date(),
          })
          .where(eq(paymentEntries.paymentId, p.paymentId));

        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.PAYMENT,
          entityId: p.paymentId,
          eventType: EventType.UPDATED,
          entityDisplayName: p.paymentNumber,
          payload: { abaExported: true },
        });
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

      const meta = (bankGl.metadata || {}) as Record<string, string>;
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
        await this.paymentsCoreService.changePaymentState(
          p.paymentId,
          PAYMENT_STATE.EXPORTED,
          actor,
          tx as unknown as DrizzleDB,
        );

        await tx
          .update(paymentEntries)
          .set({
            abaExportedAt: new Date(), // Reusing this timestamp for batch export
            modifiedOn: new Date(),
          })
          .where(eq(paymentEntries.paymentId, p.paymentId));

        await emitEvent(tx as unknown as DrizzleDB, {
          entityType: EntityType.PAYMENT,
          entityId: p.paymentId,
          eventType: EventType.UPDATED,
          entityDisplayName: p.paymentNumber,
          payload: { nachaExported: true },
        });
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
        await this.paymentsCoreService.changePaymentState(
          pid,
          PAYMENT_STATE.DRAFT,
          actor,
          tx as unknown as DrizzleDB,
        );
      }
    });
  }
}
