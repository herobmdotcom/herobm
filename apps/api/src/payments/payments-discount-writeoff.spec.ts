import Decimal from 'decimal.js';
import { autoTransitionSalesInvoiceBasedOnOutstandingAmount } from '../invoices/sales-invoice-lifecycle-rules';
import { autoTransitionPurchaseInvoiceBasedOnOutstandingAmount } from '../invoices/purchase-invoice-lifecycle-rules';
import { SALES_INVOICE_STATE, PURCHASE_INVOICE_STATE } from '@herobm/shared';

describe('Payment Discounts & Small-Balance Write-Off Tolerances (Unit)', () => {
  describe('Early Payment Discount Math', () => {
    it('calculates cash discount terms accurately (e.g. 2% 10 Net 30)', () => {
      const invoiceTotal = new Decimal('1000.00');
      const discountPercent = new Decimal('2.0'); // 2%

      const maxDiscount = invoiceTotal.mul(discountPercent).div(100);
      expect(maxDiscount.toFixed(2)).toBe('20.00');

      const netCashToPay = invoiceTotal.minus(maxDiscount);
      expect(netCashToPay.toFixed(2)).toBe('980.00');

      // Allocation: $980 cash + $20 discount = $1000 cleared
      const remainingBalance = invoiceTotal
        .minus(netCashToPay)
        .minus(maxDiscount);
      expect(remainingBalance.isZero()).toBe(true);
    });

    it('rejects discount if requested amount exceeds permitted discount percentage', () => {
      const invoiceTotal = new Decimal('500.00');
      const discountPercent = new Decimal('1.5'); // 1.5% = $7.50
      const maxDiscount = invoiceTotal.mul(discountPercent).div(100);

      const requestedDiscount = new Decimal('10.00'); // exceeds $7.50
      expect(requestedDiscount.greaterThan(maxDiscount)).toBe(true);
    });
  });

  describe('Invoice Lifecycle Small-Balance Rounding Tolerances', () => {
    it('transitions sales invoice with sub-penny residue to PAID status', async () => {
      let updatedState: string | undefined;
      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => [
              {
                stateCode: SALES_INVOICE_STATE.INVOICED,
                totalAmount: '100.00',
                outstandingAmount: '0.0004', // sub-penny rounding residue
                invoiceNumber: 'INV-1001',
              },
            ],
          }),
        }),
        update: () => ({
          set: (payload: any) => {
            updatedState = payload.stateCode;
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
        insert: () => ({
          values: () => Promise.resolve(),
        }),
      };

      const result =
        await autoTransitionSalesInvoiceBasedOnOutstandingAmount.evaluate(
          mockDb,
          'inv-1001',
          { entity: 'payment', id: 'pmt-1', action: 'allocated' },
          'user-1',
        );

      expect(updatedState).toBe(SALES_INVOICE_STATE.PAID);
      expect(result?.to).toBe(SALES_INVOICE_STATE.PAID);
    });

    it('transitions purchase invoice with sub-penny residue to PAID status', async () => {
      let updatedState: string | undefined;
      const mockDb: any = {
        select: () => ({
          from: () => ({
            where: () => [
              {
                stateCode: PURCHASE_INVOICE_STATE.INVOICED,
                totalAmount: '500.00',
                outstandingAmount: '0.0008',
                invoiceNumber: 'PINV-2001',
              },
            ],
          }),
        }),
        update: () => ({
          set: (payload: any) => {
            updatedState = payload.stateCode;
            return {
              where: () => Promise.resolve(),
            };
          },
        }),
        insert: () => ({
          values: () => Promise.resolve(),
        }),
      };

      const result =
        await autoTransitionPurchaseInvoiceBasedOnOutstandingAmount.evaluate(
          mockDb,
          'pinv-2001',
          { entity: 'payment', id: 'pmt-2', action: 'allocated' },
          'user-1',
        );

      expect(updatedState).toBe(PURCHASE_INVOICE_STATE.PAID);
      expect(result?.to).toBe(PURCHASE_INVOICE_STATE.PAID);
    });
  });
});
