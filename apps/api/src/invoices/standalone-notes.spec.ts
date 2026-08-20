import { salesCreditNotes, purchaseDebitNotes } from '@herobm/db-schema';
import { CreateSalesCreditNoteDto } from './sales-credit-notes.dto';
import { CreateDebitNoteDto } from '../purchase-debit-notes/dto';

describe('BL-015 Standalone Credit & Debit Notes Invariants', () => {
  it('Assert salesCreditNotes columns returnId, salesOrderId, invoiceId are nullable', () => {
    expect(salesCreditNotes.returnId.notNull).toBe(false);
    expect(salesCreditNotes.salesOrderId.notNull).toBe(false);
    expect(salesCreditNotes.invoiceId.notNull).toBe(false);
    expect(salesCreditNotes.customerId.notNull).toBe(true);
  });

  it('Assert purchaseDebitNotes columns returnId, purchaseOrderId are nullable', () => {
    expect(purchaseDebitNotes.returnId.notNull).toBe(false);
    expect(purchaseDebitNotes.purchaseOrderId.notNull).toBe(false);
    expect(purchaseDebitNotes.vendorId.notNull).toBe(true);
  });

  it('Verify CreateSalesCreditNoteDto instantiation without returnId', () => {
    const creditDto: CreateSalesCreditNoteDto = {
      customerId: '11111111-1111-4111-8111-111111111111',
      notes: 'Price adjustment rebate',
      lines: [
        {
          description: 'Volume discount rebate',
          amount: 150.0,
          accountId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    };
    expect(creditDto.returnId).toBeUndefined();
    expect(creditDto.lines?.length).toBe(1);
  });

  it('Verify CreateDebitNoteDto instantiation without returnId', () => {
    const debitDto: CreateDebitNoteDto = {
      vendorId: '33333333-3333-4333-8333-333333333333',
      supplierReferenceNumber: 'SUP-REBATE-2026',
      notes: 'Supplier price discrepancy rebate',
      lines: [
        {
          description: 'Overcharge adjustment',
          amount: '200.00',
          accountId: '44444444-4444-4444-8444-444444444444',
        },
      ],
    };
    expect(debitDto.returnId).toBeUndefined();
    expect(debitDto.lines.length).toBe(1);
  });
});
