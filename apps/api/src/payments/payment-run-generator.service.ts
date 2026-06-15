import { Injectable, BadRequestException } from '@nestjs/common';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { Inject } from '@nestjs/common';
import { DRIZZLE } from '../drizzle/drizzle.module';
import {
  purchaseInvoices,
  paymentEntries,
  paymentAllocations,
  suppliers,
  glSettings,
} from '../drizzle/herobm-core-schema';
import { eq, and, sql, isNull, inArray, lte } from 'drizzle-orm';
import { v4 as uuidv4 } from 'uuid';
import { PAYMENT_STATE, PAYMENT_TYPE } from '@herobm/shared';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class PaymentRunGeneratorService {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async generatePaymentRun(
    targetDate: string,
    glAccountBank: string,
    actor: string,
  ) {
    return await this.db.transaction(async (tx) => {
      const [settings] = await tx.select().from(glSettings).limit(1);
      if (!settings?.defaultDiscountsReceivedAccountId) {
        throw new BadRequestException(
          'No Default Discounts Received Account configured in GL Settings. Please configure it before generating a payment run.',
        );
      }

      // Query unpaid purchase invoices due on or before target date
      // that belong to suppliers who are not payment blocked
      const dueInvoices = await tx
        .select({
          invoiceId: purchaseInvoices.invoiceId,
          supplierId: purchaseInvoices.vendorId,
          dueDate: purchaseInvoices.dueDate,
          invoiceDate: purchaseInvoices.invoiceDate,
          totalAmount: purchaseInvoices.totalAmount,
          outstandingAmount: purchaseInvoices.outstandingAmount,
          earlyPaymentDiscount: suppliers.earlyPaymentDiscount,
          earlyPaymentDiscountDays: suppliers.earlyPaymentDiscountDays,
        })
        .from(purchaseInvoices)
        .innerJoin(suppliers, eq(purchaseInvoices.vendorId, suppliers.vendorId))
        .where(
          and(
            eq(purchaseInvoices.stateCode, 'POSTED'), // Ensure it's posted
            sql`${purchaseInvoices.outstandingAmount} > 0`,
            lte(purchaseInvoices.dueDate, new Date(targetDate)),
            eq(suppliers.isPaymentBlocked, false),
          ),
        );

      if (dueInvoices.length === 0) {
        return {
          generatedPayments: 0,
          totalCashAmount: 0,
          totalDiscountAmount: 0,
        };
      }

      // Group invoices by supplier
      const invoicesBySupplier = new Map<string, typeof dueInvoices>();
      for (const inv of dueInvoices) {
        if (!invoicesBySupplier.has(inv.supplierId)) {
          invoicesBySupplier.set(inv.supplierId, []);
        }
        invoicesBySupplier.get(inv.supplierId)!.push(inv);
      }

      let generatedPayments = 0;
      let totalCashAmount = 0;
      let totalDiscountAmount = 0;

      for (const [supplierId, invoices] of invoicesBySupplier.entries()) {
        const paymentId = uuidv4();
        let paymentTotalCash = 0;
        let paymentTotalDiscount = 0;

        const allocationsToCreate = [];

        for (const inv of invoices) {
          const unallocated = Number(inv.outstandingAmount);
          let discountAmount = 0;

          // Check if discount applies
          if (
            inv.earlyPaymentDiscount &&
            inv.earlyPaymentDiscountDays !== null
          ) {
            const discountPercent = Number(inv.earlyPaymentDiscount);
            if (discountPercent > 0) {
              const invoiceDate = new Date(
                inv.invoiceDate as string | number | Date,
              );
              const discountDeadlineDate = new Date(invoiceDate);
              discountDeadlineDate.setDate(
                discountDeadlineDate.getDate() + inv.earlyPaymentDiscountDays,
              );

              if (new Date(targetDate) <= discountDeadlineDate) {
                // Discount applies
                discountAmount = (unallocated * discountPercent) / 100;
              }
            }
          }

          const cashAmount = unallocated - discountAmount;

          paymentTotalCash += cashAmount;
          paymentTotalDiscount += discountAmount;

          allocationsToCreate.push({
            allocationId: uuidv4(),
            paymentId: paymentId,
            referenceType: 'purchase_invoice',
            referenceId: inv.invoiceId,
            allocatedAmount: cashAmount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
          });
        }

        if (paymentTotalCash > 0) {
          // Create Draft Payment
          const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${generatedPayments + 1}`;
          const [payment] = await tx
            .insert(paymentEntries)
            .values({
              paymentId,
              paymentNumber,
              paymentType: PAYMENT_TYPE.SUPPLIER_PAYMENT,
              partyId: supplierId,
              paymentDate: new Date(targetDate),
              modeOfPayment: 'EFT',
              totalAmount: paymentTotalCash.toFixed(2),
              unallocatedAmount: '0', // We are fully allocating it immediately
              stateCode: PAYMENT_STATE.DRAFT,
              currencyCode: settings.baseCurrency,
              glAccountBank: glAccountBank,
            })
            .returning();

          await tx.insert(paymentAllocations).values(allocationsToCreate);

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await emitEvent(tx as any, {
            entityType: EntityType.PAYMENT,
            entityId: paymentId,
            eventType: EventType.CREATED,
            entityDisplayName: paymentNumber,
            payload: {
              targetDate,
              generatedFromRun: true,
            },
            actor,
          });

          generatedPayments++;
          totalCashAmount += paymentTotalCash;
          totalDiscountAmount += paymentTotalDiscount;
        }
      }

      return {
        generatedPayments,
        totalCashAmount,
        totalDiscountAmount,
      };
    });
  }
}
