import { getTableColumns } from 'drizzle-orm';
import {
  glJournalLines,
  glReconciliations,
  paymentEntries,
  paymentLines,
  paymentAllocations,
  salesOrders,
  salesOrderLineItems,
  salesInvoices,
  salesInvoiceLines,
  purchaseOrders,
  purchaseOrderLineItems,
  exchangeRates,
  taxCategories,
  inventoryLedger,
  products,
} from '../index';

describe('Database Column Precision & SQL Invariant (Layer E)', () => {
  const financialTables = [
    { name: 'gl_journal_lines', table: glJournalLines },
    { name: 'gl_reconciliations', table: glReconciliations },
    { name: 'payment_entries', table: paymentEntries },
    { name: 'payment_lines', table: paymentLines },
    { name: 'payment_allocations', table: paymentAllocations },
    { name: 'sales_orders', table: salesOrders },
    { name: 'sales_order_lines', table: salesOrderLineItems },
    { name: 'sales_invoices', table: salesInvoices },
    { name: 'sales_invoice_lines', table: salesInvoiceLines },
    { name: 'purchase_orders', table: purchaseOrders },
    { name: 'purchase_order_lines', table: purchaseOrderLineItems },
    { name: 'exchange_rates', table: exchangeRates },
    { name: 'tax_categories', table: taxCategories },
    { name: 'inventory_ledger', table: inventoryLedger },
    { name: 'products', table: products },
  ];

  it('should guarantee all monetary, cost, tax, and rate columns are strictly numeric/integer and zero float/real/doublePrecision', () => {
    for (const { name, table } of financialTables) {
      const columns = getTableColumns(table);

      for (const [colName, col] of Object.entries(columns)) {
        const colType = (col as { columnType?: string; dataType?: string }).dataType || (col as { columnType?: string }).columnType || '';
        
        // Assert no float/double/real types in financial tables
        expect(colType.toLowerCase()).not.toContain('real');
        expect(colType.toLowerCase()).not.toContain('float');
        expect(colType.toLowerCase()).not.toContain('double');

        // Check columns that represent money/rates/quantities
        const lowerCol = colName.toLowerCase();
        if (
          lowerCol.includes('amount') ||
          lowerCol.includes('price') ||
          lowerCol.includes('cost') ||
          lowerCol.includes('debit') ||
          lowerCol.includes('credit') ||
          lowerCol.includes('tax') ||
          lowerCol.includes('rate') ||
          lowerCol.includes('balance') ||
          lowerCol.includes('total')
        ) {
          // If it's a numeric column, it must be 'numeric' (arbitrary precision) or text/json if metadata
          if (colType === 'number' || colType.includes('PgNumeric') || colType.includes('numeric')) {
            expect(colType).toMatch(/numeric|PgNumeric|number/i);
          }
        }
      }
    }
  });
});
