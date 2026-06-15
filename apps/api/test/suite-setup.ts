import postgres from 'postgres';

jest.setTimeout(120000);

beforeAll(async () => {
  if (process.env.USE_PGLITE === 'true') {
    return;
  }

  if (!process.env.JWT_SECRET) {
    process.env.JWT_SECRET = 'test-secret-value-for-e2e';
  }
  if (!process.env.SETUP_TOKEN) {
    process.env.SETUP_TOKEN = 'test-setup-token';
  }

  const user = process.env.POSTGRES_USER || 'postgres';
  const host = process.env.POSTGRES_HOST || 'localhost';
  const port = process.env.POSTGRES_PORT || '5432';
  const db = process.env.POSTGRES_DB || 'herobm_local';

  const connectionString =
    process.env.DATABASE_URL ||
    `postgresql://${user}:${process.env.POSTGRES_PASSWORD}@${host}:${port}/${db}`;

  if (!process.env.DATABASE_URL && !process.env.POSTGRES_PASSWORD) {
    console.warn(
      'DATABASE_URL or POSTGRES_PASSWORD is not set. Setup may fail.',
    );
  }

  const sql = postgres(connectionString);

  try {
    await sql`
      DO $$ 
      DECLARE
          r_so RECORD;
          r_po RECORD;
          r_inv RECORD;
          r_acct RECORD;
      BEGIN
          -- 1. Sales Orders & related (Invoices, Shipments, GL)
          FOR r_so IN SELECT sales_order_id FROM herobm_core.sales_orders WHERE name LIKE 'E2E%'
          LOOP
              -- Delete Invoices and their GL entries
              FOR r_inv IN SELECT invoice_id FROM herobm_core.sales_invoices WHERE sales_order_id = r_so.sales_order_id
              LOOP
                  DELETE FROM herobm_core.gl_journal_lines WHERE journal_entry_id IN (SELECT journal_entry_id FROM herobm_core.gl_journal_entries WHERE source_id::text = r_inv.invoice_id::text);
                  DELETE FROM herobm_core.gl_journal_entries WHERE source_id::text = r_inv.invoice_id::text;
                  DELETE FROM herobm_core.sales_invoice_lines WHERE invoice_id = r_inv.invoice_id;
                  DELETE FROM herobm_core.sales_invoices WHERE invoice_id = r_inv.invoice_id;
              END LOOP;
              -- Delete Credit Notes and their GL entries
              FOR r_inv IN SELECT credit_note_id FROM herobm_core.sales_credit_notes WHERE return_id IN (SELECT return_id FROM herobm_core.sales_order_returns WHERE sales_order_id = r_so.sales_order_id)
              LOOP
                  DELETE FROM herobm_core.gl_journal_lines WHERE journal_entry_id IN (SELECT journal_entry_id FROM herobm_core.gl_journal_entries WHERE source_id::text = r_inv.credit_note_id::text);
                  DELETE FROM herobm_core.gl_journal_entries WHERE source_id::text = r_inv.credit_note_id::text;
                  DELETE FROM herobm_core.sales_credit_note_lines WHERE credit_note_id = r_inv.credit_note_id;
                  DELETE FROM herobm_core.sales_credit_notes WHERE credit_note_id = r_inv.credit_note_id;
              END LOOP;
              
              DELETE FROM herobm_core.sales_order_return_lines WHERE return_id IN (SELECT return_id FROM herobm_core.sales_order_returns WHERE sales_order_id = r_so.sales_order_id);
              DELETE FROM herobm_core.sales_order_returns WHERE sales_order_id = r_so.sales_order_id;
              DELETE FROM herobm_core.sales_order_picks WHERE sales_order_id = r_so.sales_order_id;
              DELETE FROM herobm_core.sales_order_shipment_lines WHERE shipment_id IN (SELECT shipment_id FROM herobm_core.sales_order_shipments WHERE sales_order_id = r_so.sales_order_id);
              DELETE FROM herobm_core.warehouse_events WHERE entity_id IN (SELECT shipment_id FROM herobm_core.sales_order_shipments WHERE sales_order_id = r_so.sales_order_id);
              DELETE FROM herobm_core.sales_order_shipments WHERE sales_order_id = r_so.sales_order_id;

              DELETE FROM herobm_core.outbox WHERE entity_id = r_so.sales_order_id;
              DELETE FROM herobm_core.sales_events WHERE entity_id = r_so.sales_order_id;
              DELETE FROM herobm_core.backorders WHERE sales_order_id = r_so.sales_order_id;
              DELETE FROM herobm_core.sales_order_lines WHERE sales_order_id = r_so.sales_order_id;
              DELETE FROM herobm_core.sales_orders WHERE sales_order_id = r_so.sales_order_id;
          END LOOP;

          -- 2. Purchase Orders & related
          FOR r_po IN SELECT purchase_order_id, vendor_id FROM herobm_core.purchase_orders WHERE name LIKE 'E2E%'
          LOOP
              -- Delete Invoices and their GL entries
              FOR r_inv IN SELECT invoice_id FROM herobm_core.purchase_invoices WHERE purchase_order_id = r_po.purchase_order_id
              LOOP
                  DELETE FROM herobm_core.gl_journal_lines WHERE journal_entry_id IN (SELECT journal_entry_id FROM herobm_core.gl_journal_entries WHERE source_id::text = r_inv.invoice_id::text);
                  DELETE FROM herobm_core.gl_journal_entries WHERE source_id::text = r_inv.invoice_id::text;
                  DELETE FROM herobm_core.purchase_invoice_lines WHERE invoice_id = r_inv.invoice_id;
                  DELETE FROM herobm_core.purchase_invoices WHERE invoice_id = r_inv.invoice_id;
              END LOOP;

              DELETE FROM herobm_core.purchase_order_return_shipment_lines WHERE return_line_id IN (SELECT return_line_id FROM herobm_core.purchase_order_return_lines WHERE return_id IN (SELECT return_id FROM herobm_core.purchase_order_returns WHERE purchase_order_id = r_po.purchase_order_id));
              DELETE FROM herobm_core.purchase_order_return_shipments WHERE return_id IN (SELECT return_id FROM herobm_core.purchase_order_returns WHERE purchase_order_id = r_po.purchase_order_id);
              DELETE FROM herobm_core.purchase_order_return_lines WHERE return_id IN (SELECT return_id FROM herobm_core.purchase_order_returns WHERE purchase_order_id = r_po.purchase_order_id);
              DELETE FROM herobm_core.purchase_order_returns WHERE purchase_order_id = r_po.purchase_order_id;

              DELETE FROM herobm_core.goods_received_lines WHERE goods_received_id IN (SELECT goods_received_id FROM herobm_core.goods_received WHERE vendor_id = r_po.vendor_id);
              DELETE FROM herobm_core.goods_received WHERE vendor_id = r_po.vendor_id;
              DELETE FROM herobm_core.outbox WHERE entity_id = r_po.purchase_order_id;
              DELETE FROM herobm_core.procurement_events WHERE entity_id = r_po.purchase_order_id;
              DELETE FROM herobm_core.purchase_order_lines WHERE purchase_order_id = r_po.purchase_order_id;
              DELETE FROM herobm_core.purchase_orders WHERE purchase_order_id = r_po.purchase_order_id;
          END LOOP;
          
          -- 3. Push dates to future to prevent overdue tests failing
          UPDATE herobm_core.gl_journal_entries 
          SET entry_date = CURRENT_DATE + INTERVAL '365 days' 
          WHERE journal_entry_id IN (
              SELECT journal_entry_id FROM herobm_core.gl_journal_lines WHERE party_type = 'customer'
          );

      END $$;
    `;
  } catch (err) {
    console.error('❌ [Suite Setup] Cleanup failed:', err);
  } finally {
    await sql.end();
  }
});
