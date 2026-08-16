/**
 * Subledger Reversal Coverage — Structural Test
 *
 * Immunization for ADV-138.
 *
 * Ensures that every financial subledger service implementing document cancellation
 * or state rollback includes an atomic GL journal entry reversal.
 */
import * as fs from 'fs';
import * as path from 'path';

describe('Subledger GL Reversal Coverage (structural)', () => {
  const srcRoot = path.resolve(__dirname, '..');

  const REQUIRED_REVERSAL_SERVICES: {
    name: string;
    file: string;
    cancelledStateOrMethod: string;
  }[] = [
    {
      name: 'Sales Invoices',
      file: 'invoices/sales-invoice.service.ts',
      cancelledStateOrMethod: 'SALES_INVOICE_STATE.CANCELLED',
    },
    {
      name: 'Sales Credit Notes',
      file: 'invoices/sales-credit-note.service.ts',
      cancelledStateOrMethod: 'SALES_CREDIT_NOTE_STATE.CANCELLED',
    },
    {
      name: 'Purchase Invoices',
      file: 'invoices/purchase-invoice-core.service.ts',
      cancelledStateOrMethod: 'PURCHASE_INVOICE_STATE.CANCELLED',
    },
    {
      name: 'Purchase Debit Notes',
      file: 'purchase-debit-notes/purchase-debit-notes.service.ts',
      cancelledStateOrMethod: 'PURCHASE_DEBIT_NOTE_STATE.CANCELLED',
    },
    {
      name: 'Goods Received Notes',
      file: 'goods-received/goods-received-write.service.ts',
      cancelledStateOrMethod: 'cancelReception',
    },
    {
      name: 'Payment Entries',
      file: 'payments/payments-write.service.ts',
      cancelledStateOrMethod: 'PAYMENT_STATE.CANCELLED',
    },
    {
      name: 'Shipments',
      file: 'orders/shipments/shipments-state.service.ts',
      cancelledStateOrMethod: 'SHIPMENT_STATE.CANCELLED',
    },
  ];

  it.each(REQUIRED_REVERSAL_SERVICES)(
    '$name service must implement GL reversal on cancellation',
    ({ file, cancelledStateOrMethod }) => {
      const fullPath = path.join(srcRoot, file);
      expect(fs.existsSync(fullPath)).toBe(true);

      const content = fs.readFileSync(fullPath, 'utf-8');

      // 1. Must check the cancellation condition/method
      expect(content).toContain(cancelledStateOrMethod);

      // 2. Must call glService.postJournalEntry or inventory accounting reversal
      const hasGlPost =
        content.includes('glService.postJournalEntry') ||
        content.includes('this.glService.postJournalEntry');
      expect(hasGlPost).toBe(true);

      // 3. Must reference reversal / swapped debit-credit logic or reversal strategy
      const hasReversalLogic =
        content.includes('reversedLines') ||
        content.includes('reversalLines') ||
        content.includes('onDispatchReversal') ||
        content.includes('Reversal');
      expect(hasReversalLogic).toBe(true);
    },
  );
});
