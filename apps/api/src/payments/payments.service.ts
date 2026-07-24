import {
  Injectable,
  Inject,
  BadRequestException,
  Logger,
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
  customerGroups,
  suppliers,
  supplierGroups,
  glAccounts,
  paymentLines,
  salesCreditNotes,
  purchaseDebitNotes,
  supplierExpiries,
  actors,
} from '../drizzle/herobm-core-schema';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';
import { randomUUID } from 'crypto';
import { getExchangeRateForCurrency } from '../common/fx-helper';
import { GlService } from '../gl/gl.service';
import { SuppliersService } from '../suppliers/suppliers.service';
import { evaluateSalesInvoiceLifecycleRules } from '../invoices/sales-invoice-lifecycle-rules';
import { evaluatePurchaseInvoiceLifecycleRules } from '../invoices/purchase-invoice-lifecycle-rules';
import { CreatePaymentDto, AllocatePaymentDto } from './dto';
import { JournalLineDto } from '../gl/dto';
import { AbaGeneratorService } from './aba-generator.service';
import { NachaGeneratorService } from './nacha-generator.service';
import { inArray } from 'drizzle-orm';
import {
  PAYMENT_STATE,
  PAYMENT_TYPE,
  PAYMENT_TRANSITIONS,
  SALES_INVOICE_STATE,
  PURCHASE_INVOICE_STATE,
  SALES_CREDIT_NOTE_STATE,
  PURCHASE_DEBIT_NOTE_STATE,
  getValidStates,
} from '@herobm/shared';
import type { PaymentState } from '@herobm/shared';

const VALID_PAYMENT_STATES = getValidStates(PAYMENT_TRANSITIONS);

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
    private readonly abaGenerator: AbaGeneratorService,
    private readonly nachaGenerator: NachaGeneratorService,
    private readonly suppliersService: SuppliersService,
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

  async createPaymentEntry(dto: CreatePaymentDto, actor: string) {
    return await this.db.transaction(async (tx) => {
      const paymentNumber = await this.generatePaymentNumber(
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
        return await this.submitPaymentEntry(
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

      await this.glService.postJournalEntry(
        lines,
        {
          sourceId: payment.paymentId,
          sourceType: 'payment_entry',
          memo: `Payment ${payment.paymentNumber}`,
          entryDate: payment.paymentDate.toISOString().split('T')[0],
          actor,
        },
        tx,
      );

      // Process allocations (decrement outstanding amounts and emit events)
      await this._applyAllocationsToInvoices(
        tx,
        paymentId,
        payment,
        draftAllocations,
        actor,
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
      const updated = await this.changePaymentState(
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
        await this.changePaymentState(
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
        await this.changePaymentState(
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
        await this.changePaymentState(pid, PAYMENT_STATE.DRAFT, actor, tx);
      }
    });
  }

  /**
   * Universal changeState for Payments
   */
  private async _applyAllocationsToInvoices(
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

  private async _postLateAllocationJournal(
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
          sourceType: 'payment_entry',
          memo: `Late Allocation for ${payment.paymentNumber}`,
          entryDate: new Date().toISOString().split('T')[0],
          actor,
        },
        tx,
      );
    }
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
