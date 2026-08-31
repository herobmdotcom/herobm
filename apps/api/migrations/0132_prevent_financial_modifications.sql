-- Migration 0132: Prevent in-place modification of finalized financial records, GL lines, and inventory movements

-- 1. Sales Invoices
CREATE OR REPLACE FUNCTION herobm_core.prevent_sales_invoice_modification()
RETURNS trigger AS $$
BEGIN
  IF OLD.state_code != 'draft' THEN
    IF (NEW.invoice_number IS DISTINCT FROM OLD.invoice_number) OR
       (NEW.customer_id IS DISTINCT FROM OLD.customer_id) OR
       (NEW.sales_order_id IS DISTINCT FROM OLD.sales_order_id) OR
       (NEW.invoice_date IS DISTINCT FROM OLD.invoice_date) OR
       (NEW.currency_code IS DISTINCT FROM OLD.currency_code) OR
       (NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate) OR
       (NEW.total_amount IS DISTINCT FROM OLD.total_amount) OR
       (NEW.tax_amount IS DISTINCT FROM OLD.tax_amount) OR
       (NEW.base_total_amount IS DISTINCT FROM OLD.base_total_amount) THEN
      RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying financial amounts, currency, customer, or dates on issued sales invoice % is prohibited. Use cancellation or credit notes.', OLD.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_sales_invoices ON herobm_core.sales_invoices;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_sales_invoices
BEFORE UPDATE ON herobm_core.sales_invoices
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_invoice_modification();--> statement-breakpoint

-- 2. Sales Invoice Lines
CREATE OR REPLACE FUNCTION herobm_core.prevent_sales_invoice_line_modification()
RETURNS trigger AS $$
DECLARE
  parent_state text;
BEGIN
  SELECT state_code INTO parent_state FROM herobm_core.sales_invoices WHERE invoice_id = OLD.invoice_id;
  IF parent_state IS NOT NULL AND parent_state != 'draft' THEN
    IF (NEW.sales_order_line_id IS DISTINCT FROM OLD.sales_order_line_id) OR
       (NEW.quantity_invoiced IS DISTINCT FROM OLD.quantity_invoiced) OR
       (NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit) OR
       (NEW.amount IS DISTINCT FROM OLD.amount) THEN
      RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying line item values on issued sales invoice % is prohibited.', OLD.invoice_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_sales_invoice_lines ON herobm_core.sales_invoice_lines;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_sales_invoice_lines
BEFORE UPDATE ON herobm_core.sales_invoice_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_invoice_line_modification();--> statement-breakpoint

-- 3. Sales Credit Notes
CREATE OR REPLACE FUNCTION herobm_core.prevent_sales_credit_note_modification()
RETURNS trigger AS $$
BEGIN
  IF (NEW.credit_note_number IS DISTINCT FROM OLD.credit_note_number) OR
     (NEW.customer_id IS DISTINCT FROM OLD.customer_id) OR
     (NEW.total_amount IS DISTINCT FROM OLD.total_amount) OR
     (NEW.tax_amount IS DISTINCT FROM OLD.tax_amount) OR
     (NEW.currency_code IS DISTINCT FROM OLD.currency_code) OR
     (NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate) OR
     (NEW.base_total_amount IS DISTINCT FROM OLD.base_total_amount) THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying financial amounts, currency, or customer on credit note % is prohibited.', OLD.credit_note_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_sales_credit_notes ON herobm_core.sales_credit_notes;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_sales_credit_notes
BEFORE UPDATE ON herobm_core.sales_credit_notes
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_credit_note_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_sales_credit_note_lines ON herobm_core.sales_credit_note_lines;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_sales_credit_note_lines
BEFORE UPDATE ON herobm_core.sales_credit_note_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

-- 4. Purchase Invoices
CREATE OR REPLACE FUNCTION herobm_core.prevent_purchase_invoice_modification()
RETURNS trigger AS $$
BEGIN
  IF OLD.state_code != 'draft' THEN
    IF (NEW.invoice_number IS DISTINCT FROM OLD.invoice_number) OR
       (NEW.vendor_id IS DISTINCT FROM OLD.vendor_id) OR
       (NEW.purchase_order_id IS DISTINCT FROM OLD.purchase_order_id) OR
       (NEW.total_amount IS DISTINCT FROM OLD.total_amount) OR
       (NEW.tax_amount IS DISTINCT FROM OLD.tax_amount) OR
       (NEW.currency_code IS DISTINCT FROM OLD.currency_code) OR
       (NEW.exchange_rate IS DISTINCT FROM OLD.exchange_rate) THEN
      RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying financial amounts, currency, or vendor on purchase invoice % is prohibited.', OLD.invoice_number;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_purchase_invoices ON herobm_core.purchase_invoices;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_purchase_invoices
BEFORE UPDATE ON herobm_core.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_purchase_invoice_modification();--> statement-breakpoint

-- 5. General Ledger Journal Entries
CREATE OR REPLACE FUNCTION herobm_core.prevent_gl_journal_modification()
RETURNS trigger AS $$
BEGIN
  IF (NEW.entry_number IS DISTINCT FROM OLD.entry_number) OR
     (NEW.entry_date IS DISTINCT FROM OLD.entry_date) OR
     (NEW.source_type IS DISTINCT FROM OLD.source_type) OR
     (NEW.source_id IS DISTINCT FROM OLD.source_id) THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying entry number, date, or source on journal entry % is prohibited.', OLD.entry_number;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_gl_journal_entries ON herobm_core.gl_journal_entries;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_gl_journal_entries
BEFORE UPDATE ON herobm_core.gl_journal_entries
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_gl_journal_modification();--> statement-breakpoint

-- 6. General Ledger Journal Lines
CREATE OR REPLACE FUNCTION herobm_core.prevent_gl_journal_line_modification()
RETURNS trigger AS $$
BEGIN
  IF (NEW.journal_entry_id IS DISTINCT FROM OLD.journal_entry_id) OR
     (NEW.gl_account_id IS DISTINCT FROM OLD.gl_account_id) OR
     (NEW.debit IS DISTINCT FROM OLD.debit) OR
     (NEW.credit IS DISTINCT FROM OLD.credit) OR
     (NEW.party_type IS DISTINCT FROM OLD.party_type) OR
     (NEW.party_id IS DISTINCT FROM OLD.party_id) THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying financial debit, credit, account, or party on journal lines is prohibited.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_gl_journal_lines ON herobm_core.gl_journal_lines;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_gl_journal_lines
BEFORE UPDATE ON herobm_core.gl_journal_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_gl_journal_line_modification();--> statement-breakpoint

-- 7. Inventory Ledger & Domain Audit Events (Strictly Append-Only)
CREATE OR REPLACE FUNCTION herobm_core.prevent_append_only_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'COMPLIANCE VIOLATION: Table % is strictly append-only. Modifying existing records is prohibited by audit policy.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_inventory_ledger ON herobm_core.inventory_ledger;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_inventory_ledger
BEFORE UPDATE ON herobm_core.inventory_ledger
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_sales_events ON herobm_core.sales_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_sales_events
BEFORE UPDATE ON herobm_core.sales_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_financial_events ON herobm_core.financial_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_financial_events
BEFORE UPDATE ON herobm_core.financial_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_inventory_events ON herobm_core.inventory_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_inventory_events
BEFORE UPDATE ON herobm_core.inventory_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_procurement_events ON herobm_core.procurement_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_procurement_events
BEFORE UPDATE ON herobm_core.procurement_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_warehouse_events ON herobm_core.warehouse_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_warehouse_events
BEFORE UPDATE ON herobm_core.warehouse_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_master_data_events ON herobm_core.master_data_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_master_data_events
BEFORE UPDATE ON herobm_core.master_data_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_guard_update_user_events ON herobm_core.user_events;--> statement-breakpoint
CREATE TRIGGER trg_guard_update_user_events
BEFORE UPDATE ON herobm_core.user_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();
