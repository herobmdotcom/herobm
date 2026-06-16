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
import { eq, and, sql, isNull, inArray, lte, or, isNotNull } from 'drizzle-orm';
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
    invoiceIds: string[],
  ) {
    return await this.db.transaction(async (tx) => {
      const [settings] = await tx.select().from(glSettings).limit(1);
      if (!settings?.defaultDiscountsReceivedAccountId) {
        throw new BadRequestException(
          'No Default Discounts Received Account configured in GL Settings. Please configure it before generating a payment run.',
        );
      }

      // Fetch only the selected invoices
      const selectedInvoices = await tx
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
            eq(purchaseInvoices.stateCode, 'POSTED'),
            sql`${purchaseInvoices.outstandingAmount} > 0`,
            inArray(purchaseInvoices.invoiceId, invoiceIds),
          ),
        );

      if (selectedInvoices.length === 0) {
        return {
          generatedPayments: 0,
          totalCashAmount: 0,
          totalDiscountAmount: 0,
        };
      }

      let generatedPayments = 0;
      let totalCashAmount = 0;
      let totalDiscountAmount = 0;

      for (const inv of selectedInvoices) {
        const paymentId = uuidv4();
        const unallocated = Number(inv.outstandingAmount);
        let discountAmount = 0;

        // Check if discount applies
        if (inv.earlyPaymentDiscount && inv.earlyPaymentDiscountDays !== null) {
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

        totalCashAmount += cashAmount;
        totalDiscountAmount += discountAmount;

        const allocationsToCreate = [
          {
            allocationId: uuidv4(),
            paymentId: paymentId,
            referenceType: 'purchase_invoice',
            referenceId: inv.invoiceId,
            allocatedAmount: cashAmount.toFixed(2),
            discountAmount: discountAmount.toFixed(2),
          },
        ];

        if (cashAmount > 0) {
          // Create Draft Payment
          const paymentNumber = `PAY-${Date.now().toString().slice(-6)}-${generatedPayments + 1}`;
          const [payment] = await tx
            .insert(paymentEntries)
            .values({
              paymentId,
              paymentNumber,
              paymentType: PAYMENT_TYPE.SUPPLIER_PAYMENT,
              partyId: inv.supplierId,
              paymentDate: new Date(targetDate),
              modeOfPayment: 'EFT',
              totalAmount: cashAmount.toFixed(2),
              unallocatedAmount: '0', // We are fully allocating it immediately
              stateCode: PAYMENT_STATE.DRAFT,
              currencyCode: settings.baseCurrency,
              glAccountBank: glAccountBank,
            })
            .returning();

          await tx.insert(paymentAllocations).values(allocationsToCreate);

          await emitEvent(tx, {
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
        }
      }

      return {
        generatedPayments,
        totalCashAmount,
        totalDiscountAmount,
      };
    });
  }

  async getPaymentRunCandidates(targetDate: string) {
    return await this.db.transaction(async (tx) => {
      // Query unpaid purchase invoices due on or before target date + 7 days
      // or those that have an early payment discount opportunity
      const dueInvoices = await tx
        .select({
          invoiceId: purchaseInvoices.invoiceId,
          invoiceNumber: purchaseInvoices.invoiceNumber,
          supplierId: purchaseInvoices.vendorId,
          supplierName: suppliers.name,
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
            eq(suppliers.isPaymentBlocked, false),
            or(
              // Allow a slightly wider window to show "Other" candidates, maybe everything unpaid
              // The user wants "Other" as well, so we should just fetch ALL unpaid posted invoices
              // and categorize them in JS!
              // Wait, let's just fetch all unpaid invoices for unblocked suppliers.
              sql`1=1`,
            ),
          ),
        );

      const target = new Date(targetDate);
      const candidates = [];

      for (const inv of dueInvoices) {
        const unallocated = Number(inv.outstandingAmount);
        let discountAmount = 0;
        let hasDiscountOpportunity = false;

        // Check if discount applies
        if (inv.earlyPaymentDiscount && inv.earlyPaymentDiscountDays !== null) {
          const discountPercent = Number(inv.earlyPaymentDiscount);
          if (discountPercent > 0) {
            const invoiceDate = new Date(
              inv.invoiceDate as string | number | Date,
            );
            const discountDeadlineDate = new Date(invoiceDate);
            discountDeadlineDate.setDate(
              discountDeadlineDate.getDate() + inv.earlyPaymentDiscountDays,
            );

            if (target <= discountDeadlineDate) {
              discountAmount = (unallocated * discountPercent) / 100;
              hasDiscountOpportunity = true;
            }
          }
        }

        const cashAmount = unallocated - discountAmount;

        // Due soon: Due date is within 7 days of target date, or already past due
        const dueSoonThreshold = new Date(target);
        dueSoonThreshold.setDate(dueSoonThreshold.getDate() + 7);
        const invDueDate = new Date(inv.dueDate as string | number | Date);

        const isDueSoon = invDueDate <= dueSoonThreshold;

        candidates.push({
          ...inv,
          cashAmount,
          discountAmount,
          hasDiscountOpportunity,
          isDueSoon,
        });
      }

      return candidates;
    });
  }
}
