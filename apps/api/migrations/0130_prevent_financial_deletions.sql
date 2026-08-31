-- Migration 0130: Add Postgres immutability triggers to prevent hard deletion of financial records
CREATE OR REPLACE FUNCTION herobm_core.prevent_financial_deletion()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table % is prohibited by tax audit policy. Use voiding, status cancellations, or credit notes.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_invoices ON herobm_core.sales_invoices;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_invoices
BEFORE DELETE ON herobm_core.sales_invoices
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_invoice_lines ON herobm_core.sales_invoice_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_invoice_lines
BEFORE DELETE ON herobm_core.sales_invoice_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_credit_notes ON herobm_core.sales_credit_notes;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_credit_notes
BEFORE DELETE ON herobm_core.sales_credit_notes
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_credit_note_lines ON herobm_core.sales_credit_note_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_credit_note_lines
BEFORE DELETE ON herobm_core.sales_credit_note_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_purchase_invoices ON herobm_core.purchase_invoices;--> statement-breakpoint
CREATE TRIGGER trg_protect_purchase_invoices
BEFORE DELETE ON herobm_core.purchase_invoices
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_purchase_invoice_lines ON herobm_core.purchase_invoice_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_purchase_invoice_lines
BEFORE DELETE ON herobm_core.purchase_invoice_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_purchase_debit_notes ON herobm_core.purchase_debit_notes;--> statement-breakpoint
CREATE TRIGGER trg_protect_purchase_debit_notes
BEFORE DELETE ON herobm_core.purchase_debit_notes
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_purchase_debit_note_lines ON herobm_core.purchase_debit_note_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_purchase_debit_note_lines
BEFORE DELETE ON herobm_core.purchase_debit_note_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_gl_journal_entries ON herobm_core.gl_journal_entries;--> statement-breakpoint
CREATE TRIGGER trg_protect_gl_journal_entries
BEFORE DELETE ON herobm_core.gl_journal_entries
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_gl_journal_lines ON herobm_core.gl_journal_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_gl_journal_lines
BEFORE DELETE ON herobm_core.gl_journal_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_payment_entries ON herobm_core.payment_entries;--> statement-breakpoint
CREATE TRIGGER trg_protect_payment_entries
BEFORE DELETE ON herobm_core.payment_entries
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_payment_lines ON herobm_core.payment_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_payment_lines
BEFORE DELETE ON herobm_core.payment_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_payment_allocations ON herobm_core.payment_allocations;--> statement-breakpoint
CREATE TRIGGER trg_protect_payment_allocations
BEFORE DELETE ON herobm_core.payment_allocations
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_events ON herobm_core.sales_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_events
BEFORE DELETE ON herobm_core.sales_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_financial_events ON herobm_core.financial_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_financial_events
BEFORE DELETE ON herobm_core.financial_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();
