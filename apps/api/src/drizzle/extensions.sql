-- ==============================================================================
-- HeroBM Core Extensions
-- This file contains all custom Postgres logic (Views, Triggers, Functions, Policies)
-- that standard Drizzle ORM generation does not natively handle.
-- It is applied continuously and MUST remain fully idempotent 
-- (use OR REPLACE, DROP IF EXISTS, and IF NOT EXISTS).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. SCALABLE INVENTORY LEVELS VIEW
-- Consolidates the physical ledger with incoming/outgoing spatial commitments
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS herobm_core.inventory_levels;
CREATE OR REPLACE VIEW herobm_core.inventory_levels AS
SELECT
    gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE((
        SELECT SUM(bc.actual_quantity)
        FROM herobm_core.bin_contents bc
        JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
        JOIN herobm_core.zones z ON z.zone_id = b.zone_id
        WHERE bc.product_id = p.product_id
          AND z.location_id = l.location_id
          AND b.bin_type NOT IN ('staging', 'quarantine')
          AND COALESCE(b.is_unavailable, false) = false
          AND COALESCE(b.is_bonded, false) = false
    ), 0) AS quantity_on_hand,
    COALESCE((
        -- Committed: Backorders marked 'received_reserved' AND any confirmed sales orders that haven't been picked.
        (SELECT COALESCE(SUM(b.quantity), 0)
         FROM herobm_core.backorders b
         JOIN herobm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
         WHERE sol.product_id = p.product_id
         AND sol.fulfillment_location_id = l.location_id
         AND b.state_code = 'received_reserved')
        +
        -- Sum open sales order lines that are confirmed
        (SELECT COALESCE(SUM(sol.quantity - COALESCE(
            (SELECT SUM(sop.quantity) 
             FROM herobm_core.sales_order_picks sop 
             WHERE sop.sales_order_line_id = sol.sales_order_line_id), 0)), 0)
         FROM herobm_core.sales_order_lines sol
         JOIN herobm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
         WHERE sol.product_id = p.product_id
         AND sol.fulfillment_location_id = l.location_id
         AND so.state_code IN ('confirmed', 'picking', 'partially_picked', 'packed', 'partially_dispatched')
        )
    ), 0) AS quantity_committed,
    0 AS quantity_reserved,
    COALESCE((
        -- Incoming: Active POs excluding 'draft'
        SELECT SUM(pol.quantity - pol.quantity_received) 
        FROM herobm_core.purchase_order_lines pol 
        JOIN herobm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id 
        WHERE pol.product_id = p.product_id 
        AND po.delivery_location_id = l.location_id
        AND po.state_code NOT IN ('draft', 'cancelled', 'completed')
    ), 0) AS quantity_on_order
FROM herobm_core.products p
CROSS JOIN herobm_core.locations l;


-- ------------------------------------------------------------------------------
-- 2. DASHBOARD TIMELINE VIEW
-- Aggregates domain events across all subsystems into a unified feed
-- ------------------------------------------------------------------------------
DROP VIEW IF EXISTS herobm_core.dashboard_timeline;
CREATE OR REPLACE VIEW herobm_core.dashboard_timeline AS
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.sales_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.procurement_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.warehouse_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.master_data_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.financial_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.inventory_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM herobm_core.system_events
UNION ALL
SELECT event_id, 'user' AS entity_type, user_id AS entity_id, event_type, NULL::text AS entity_display_name, payload, actor, created_on FROM herobm_core.user_events;


-- ------------------------------------------------------------------------------
-- 3. LOCATION TOPOGRAPHY TRIGGER
-- Automatically builds universal default "HANDLING" zone and staging bins
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION herobm_core.trg_scaffold_system_bins()
RETURNS TRIGGER AS $$
DECLARE
    handling_zone_id UUID;
BEGIN
    handling_zone_id := gen_random_uuid();
    INSERT INTO herobm_core.zones (zone_id, location_id, code, name, source, created_by)
    VALUES (handling_zone_id, NEW.location_id, 'HANDLING', 'Handling Zone', 'system', 'system');

    INSERT INTO herobm_core.bins (bin_number, zone_id, bin_type, source, is_unavailable, created_by)
    VALUES 
        ('SHIPPING', handling_zone_id, 'staging', 'system', true, 'system'),
        ('RECEIVING', handling_zone_id, 'staging', 'system', true, 'system'),
        ('CUSTOMER_RETURNS', handling_zone_id, 'staging', 'system', true, 'system'),
        ('SUPPLIER_RETURNS', handling_zone_id, 'staging', 'system', true, 'system'),
        ('INTRA_TRANSIT', handling_zone_id, 'in_transit', 'system', true, 'system');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS scaffold_handling_bins ON herobm_core.locations;
CREATE TRIGGER scaffold_handling_bins
AFTER INSERT ON herobm_core.locations
FOR EACH ROW EXECUTE FUNCTION herobm_core.trg_scaffold_system_bins();


-- ------------------------------------------------------------------------------
-- 4. OUTBOX LISTEN / NOTIFY TRIGGERS
-- Publishes notifications on PostgreSQL channels for real-time event dispatch
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION herobm_core.notify_outbox_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('herobm_outbox_events', NEW.outbox_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_outbox_notify ON herobm_core.outbox;
CREATE TRIGGER trg_outbox_notify
AFTER INSERT ON herobm_core.outbox
FOR EACH ROW EXECUTE FUNCTION herobm_core.notify_outbox_event();

CREATE OR REPLACE FUNCTION herobm_core.notify_email_outbox_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('herobm_email_outbox_events', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_email_outbox_notify ON herobm_core.email_outbox;
CREATE TRIGGER trg_email_outbox_notify
AFTER INSERT ON herobm_core.email_outbox
FOR EACH ROW EXECUTE FUNCTION herobm_core.notify_email_outbox_event();


-- ------------------------------------------------------------------------------
-- 5. IMMUTABILITY: HARD DELETION PROTECTION TRIGGERS
-- Enforces compliance by preventing DELETE on financial, inventory, and audit tables
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION herobm_core.prevent_financial_deletion()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table % is prohibited by tax audit policy. Use voiding, status cancellations, or credit notes.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

-- Invoices & Credit / Debit Notes
DROP TRIGGER IF EXISTS trg_protect_sales_invoices ON herobm_core.sales_invoices;
CREATE TRIGGER trg_protect_sales_invoices BEFORE DELETE ON herobm_core.sales_invoices FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_sales_invoice_lines ON herobm_core.sales_invoice_lines;
CREATE TRIGGER trg_protect_sales_invoice_lines BEFORE DELETE ON herobm_core.sales_invoice_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_sales_credit_notes ON herobm_core.sales_credit_notes;
CREATE TRIGGER trg_protect_sales_credit_notes BEFORE DELETE ON herobm_core.sales_credit_notes FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_sales_credit_note_lines ON herobm_core.sales_credit_note_lines;
CREATE TRIGGER trg_protect_sales_credit_note_lines BEFORE DELETE ON herobm_core.sales_credit_note_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_purchase_invoices ON herobm_core.purchase_invoices;
CREATE TRIGGER trg_protect_purchase_invoices BEFORE DELETE ON herobm_core.purchase_invoices FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_purchase_invoice_lines ON herobm_core.purchase_invoice_lines;
CREATE TRIGGER trg_protect_purchase_invoice_lines BEFORE DELETE ON herobm_core.purchase_invoice_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_purchase_debit_notes ON herobm_core.purchase_debit_notes;
CREATE TRIGGER trg_protect_purchase_debit_notes BEFORE DELETE ON herobm_core.purchase_debit_notes FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_purchase_debit_note_lines ON herobm_core.purchase_debit_note_lines;
CREATE TRIGGER trg_protect_purchase_debit_note_lines BEFORE DELETE ON herobm_core.purchase_debit_note_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

-- GL Journals
DROP TRIGGER IF EXISTS trg_protect_gl_journal_entries ON herobm_core.gl_journal_entries;
CREATE TRIGGER trg_protect_gl_journal_entries BEFORE DELETE ON herobm_core.gl_journal_entries FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_gl_journal_lines ON herobm_core.gl_journal_lines;
CREATE TRIGGER trg_protect_gl_journal_lines BEFORE DELETE ON herobm_core.gl_journal_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

-- Inventory Subledger & Movements
DROP TRIGGER IF EXISTS trg_protect_inventory_ledger ON herobm_core.inventory_ledger;
CREATE TRIGGER trg_protect_inventory_ledger BEFORE DELETE ON herobm_core.inventory_ledger FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_goods_received ON herobm_core.goods_received;
CREATE TRIGGER trg_protect_goods_received BEFORE DELETE ON herobm_core.goods_received FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_goods_received_lines ON herobm_core.goods_received_lines;
CREATE TRIGGER trg_protect_goods_received_lines BEFORE DELETE ON herobm_core.goods_received_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_sales_order_shipments ON herobm_core.sales_order_shipments;
CREATE TRIGGER trg_protect_sales_order_shipments BEFORE DELETE ON herobm_core.sales_order_shipments FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_sales_order_shipment_lines ON herobm_core.sales_order_shipment_lines;
CREATE TRIGGER trg_protect_sales_order_shipment_lines BEFORE DELETE ON herobm_core.sales_order_shipment_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_po_return_shipments ON herobm_core.purchase_order_return_shipments;
CREATE TRIGGER trg_protect_po_return_shipments BEFORE DELETE ON herobm_core.purchase_order_return_shipments FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_po_return_shipment_lines ON herobm_core.purchase_order_return_shipment_lines;
CREATE TRIGGER trg_protect_po_return_shipment_lines BEFORE DELETE ON herobm_core.purchase_order_return_shipment_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_transfer_order_shipments ON herobm_core.transfer_order_shipments;
CREATE TRIGGER trg_protect_transfer_order_shipments BEFORE DELETE ON herobm_core.transfer_order_shipments FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_transfer_order_shipment_lines ON herobm_core.transfer_order_shipment_lines;
CREATE TRIGGER trg_protect_transfer_order_shipment_lines BEFORE DELETE ON herobm_core.transfer_order_shipment_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_transfer_order_receipts ON herobm_core.transfer_order_receipts;
CREATE TRIGGER trg_protect_transfer_order_receipts BEFORE DELETE ON herobm_core.transfer_order_receipts FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_transfer_order_receipt_lines ON herobm_core.transfer_order_receipt_lines;
CREATE TRIGGER trg_protect_transfer_order_receipt_lines BEFORE DELETE ON herobm_core.transfer_order_receipt_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_bank_statement_lines ON herobm_core.bank_statement_lines;
CREATE TRIGGER trg_protect_bank_statement_lines BEFORE DELETE ON herobm_core.bank_statement_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_gl_reconciliations ON herobm_core.gl_reconciliations;
CREATE TRIGGER trg_protect_gl_reconciliations BEFORE DELETE ON herobm_core.gl_reconciliations FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_gl_match_groups ON herobm_core.gl_match_groups;
CREATE TRIGGER trg_protect_gl_match_groups BEFORE DELETE ON herobm_core.gl_match_groups FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

-- Domain Audit Logs
DROP TRIGGER IF EXISTS trg_protect_sales_events ON herobm_core.sales_events;
CREATE TRIGGER trg_protect_sales_events BEFORE DELETE ON herobm_core.sales_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_financial_events ON herobm_core.financial_events;
CREATE TRIGGER trg_protect_financial_events BEFORE DELETE ON herobm_core.financial_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_procurement_events ON herobm_core.procurement_events;
CREATE TRIGGER trg_protect_procurement_events BEFORE DELETE ON herobm_core.procurement_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_inventory_events ON herobm_core.inventory_events;
CREATE TRIGGER trg_protect_inventory_events BEFORE DELETE ON herobm_core.inventory_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_warehouse_events ON herobm_core.warehouse_events;
CREATE TRIGGER trg_protect_warehouse_events BEFORE DELETE ON herobm_core.warehouse_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_master_data_events ON herobm_core.master_data_events;
CREATE TRIGGER trg_protect_master_data_events BEFORE DELETE ON herobm_core.master_data_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_user_events ON herobm_core.user_events;
CREATE TRIGGER trg_protect_user_events BEFORE DELETE ON herobm_core.user_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_reconciliation_events ON herobm_core.reconciliation_events;
CREATE TRIGGER trg_protect_reconciliation_events BEFORE DELETE ON herobm_core.reconciliation_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_group_events ON herobm_core.group_events;
CREATE TRIGGER trg_protect_group_events BEFORE DELETE ON herobm_core.group_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_email_events ON herobm_core.email_events;
CREATE TRIGGER trg_protect_email_events BEFORE DELETE ON herobm_core.email_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_business_report_events ON herobm_core.business_report_events;
CREATE TRIGGER trg_protect_business_report_events BEFORE DELETE ON herobm_core.business_report_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_integration_events ON herobm_core.integration_events;
CREATE TRIGGER trg_protect_integration_events BEFORE DELETE ON herobm_core.integration_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

-- Historical Financial Configuration
DROP TRIGGER IF EXISTS trg_protect_exchange_rates ON herobm_core.exchange_rates;
CREATE TRIGGER trg_protect_exchange_rates BEFORE DELETE ON herobm_core.exchange_rates FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();

DROP TRIGGER IF EXISTS trg_protect_gl_fiscal_periods ON herobm_core.gl_fiscal_periods;
CREATE TRIGGER trg_protect_gl_fiscal_periods BEFORE DELETE ON herobm_core.gl_fiscal_periods FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();


-- ------------------------------------------------------------------------------
-- 6. PAYMENT RECORD DELETION GUARDS (Allowing Draft Deletion Only)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION herobm_core.guard_delete_draft_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state_code != 'draft' THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table % is prohibited when state is % (only draft records can be deleted). Use voiding, status cancellations, or credit notes.', TG_TABLE_NAME, OLD.state_code;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION herobm_core.guard_delete_payment_lines()
RETURNS TRIGGER AS $$
DECLARE
  v_state text;
BEGIN
  SELECT state_code INTO v_state FROM herobm_core.payment_entries WHERE payment_id = OLD.payment_id;
  IF v_state IS NOT NULL AND v_state != 'draft' THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table payment_lines is prohibited when payment is % (only draft records can be deleted).', v_state;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION herobm_core.guard_delete_payment_allocations()
RETURNS TRIGGER AS $$
DECLARE
  v_state text;
BEGIN
  SELECT state_code INTO v_state FROM herobm_core.payment_entries WHERE payment_id = OLD.payment_id;
  IF v_state IS NOT NULL AND v_state != 'draft' THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table payment_allocations is prohibited when payment is % (only draft records can be deleted).', v_state;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_payment_entries ON herobm_core.payment_entries;
CREATE TRIGGER trg_protect_payment_entries BEFORE DELETE ON herobm_core.payment_entries FOR EACH ROW EXECUTE FUNCTION herobm_core.guard_delete_draft_payment();

DROP TRIGGER IF EXISTS trg_protect_payment_lines ON herobm_core.payment_lines;
CREATE TRIGGER trg_protect_payment_lines BEFORE DELETE ON herobm_core.payment_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.guard_delete_payment_lines();

DROP TRIGGER IF EXISTS trg_protect_payment_allocations ON herobm_core.payment_allocations;
CREATE TRIGGER trg_protect_payment_allocations BEFORE DELETE ON herobm_core.payment_allocations FOR EACH ROW EXECUTE FUNCTION herobm_core.guard_delete_payment_allocations();


-- ------------------------------------------------------------------------------
-- 7. IMMUTABILITY: IN-PLACE MODIFICATION PROTECTION TRIGGERS
-- ------------------------------------------------------------------------------
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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_sales_invoices ON herobm_core.sales_invoices;
CREATE TRIGGER trg_guard_update_sales_invoices BEFORE UPDATE ON herobm_core.sales_invoices FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_invoice_modification();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_sales_invoice_lines ON herobm_core.sales_invoice_lines;
CREATE TRIGGER trg_guard_update_sales_invoice_lines BEFORE UPDATE ON herobm_core.sales_invoice_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_invoice_line_modification();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_sales_credit_notes ON herobm_core.sales_credit_notes;
CREATE TRIGGER trg_guard_update_sales_credit_notes BEFORE UPDATE ON herobm_core.sales_credit_notes FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_credit_note_modification();

CREATE OR REPLACE FUNCTION herobm_core.prevent_sales_credit_note_line_modification()
RETURNS trigger AS $$
BEGIN
  IF (NEW.credit_note_id IS DISTINCT FROM OLD.credit_note_id) OR
     (NEW.quantity_credited IS DISTINCT FROM OLD.quantity_credited) OR
     (NEW.price_per_unit IS DISTINCT FROM OLD.price_per_unit) OR
     (NEW.amount IS DISTINCT FROM OLD.amount) THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Modifying line item values on sales credit note % is prohibited.', OLD.credit_note_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_sales_credit_note_lines ON herobm_core.sales_credit_note_lines;
CREATE TRIGGER trg_guard_update_sales_credit_note_lines BEFORE UPDATE ON herobm_core.sales_credit_note_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_sales_credit_note_line_modification();


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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_purchase_invoices ON herobm_core.purchase_invoices;
CREATE TRIGGER trg_guard_update_purchase_invoices BEFORE UPDATE ON herobm_core.purchase_invoices FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_purchase_invoice_modification();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_gl_journal_entries ON herobm_core.gl_journal_entries;
CREATE TRIGGER trg_guard_update_gl_journal_entries BEFORE UPDATE ON herobm_core.gl_journal_entries FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_gl_journal_modification();

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
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_gl_journal_lines ON herobm_core.gl_journal_lines;
CREATE TRIGGER trg_guard_update_gl_journal_lines BEFORE UPDATE ON herobm_core.gl_journal_lines FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_gl_journal_line_modification();

CREATE OR REPLACE FUNCTION herobm_core.prevent_append_only_modification()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'COMPLIANCE VIOLATION: Table % is strictly append-only. Modifying existing records is prohibited by audit policy.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_guard_update_inventory_ledger ON herobm_core.inventory_ledger;
CREATE TRIGGER trg_guard_update_inventory_ledger BEFORE UPDATE ON herobm_core.inventory_ledger FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_sales_events ON herobm_core.sales_events;
CREATE TRIGGER trg_guard_update_sales_events BEFORE UPDATE ON herobm_core.sales_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_financial_events ON herobm_core.financial_events;
CREATE TRIGGER trg_guard_update_financial_events BEFORE UPDATE ON herobm_core.financial_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_inventory_events ON herobm_core.inventory_events;
CREATE TRIGGER trg_guard_update_inventory_events BEFORE UPDATE ON herobm_core.inventory_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_procurement_events ON herobm_core.procurement_events;
CREATE TRIGGER trg_guard_update_procurement_events BEFORE UPDATE ON herobm_core.procurement_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_warehouse_events ON herobm_core.warehouse_events;
CREATE TRIGGER trg_guard_update_warehouse_events BEFORE UPDATE ON herobm_core.warehouse_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_master_data_events ON herobm_core.master_data_events;
CREATE TRIGGER trg_guard_update_master_data_events BEFORE UPDATE ON herobm_core.master_data_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();

DROP TRIGGER IF EXISTS trg_guard_update_user_events ON herobm_core.user_events;
CREATE TRIGGER trg_guard_update_user_events BEFORE UPDATE ON herobm_core.user_events FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_append_only_modification();


-- ------------------------------------------------------------------------------
-- 8. FISCAL PERIOD HARD LOCK ENFORCEMENT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION herobm_core.enforce_gl_journal_fiscal_period_lock()
RETURNS trigger AS $$
DECLARE
  v_period_name text;
  v_start_date date;
  v_end_date date;
BEGIN
  SELECT period_name, start_date, end_date
    INTO v_period_name, v_start_date, v_end_date
    FROM herobm_core.gl_fiscal_periods
   WHERE NEW.entry_date >= start_date
     AND NEW.entry_date <= end_date
     AND status = 'hard_closed'
   LIMIT 1;

  IF v_period_name IS NOT NULL THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Cannot post journal entry into hard-closed accounting period % (% to %). Postings in closed periods are forbidden by statutory accounting policy.',
      v_period_name, v_start_date, v_end_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_fiscal_period_lock_insert ON herobm_core.gl_journal_entries;
CREATE TRIGGER trg_enforce_fiscal_period_lock_insert BEFORE INSERT ON herobm_core.gl_journal_entries FOR EACH ROW EXECUTE FUNCTION herobm_core.enforce_gl_journal_fiscal_period_lock();

DROP TRIGGER IF EXISTS trg_enforce_fiscal_period_lock_update ON herobm_core.gl_journal_entries;
CREATE TRIGGER trg_enforce_fiscal_period_lock_update BEFORE UPDATE OF entry_date ON herobm_core.gl_journal_entries FOR EACH ROW EXECUTE FUNCTION herobm_core.enforce_gl_journal_fiscal_period_lock();


-- ------------------------------------------------------------------------------
-- 9. CASBIN DEFAULT AUTHORIZATION POLICIES
-- Seed initial RBAC policies for viewer, finance, and admin roles
-- ------------------------------------------------------------------------------
INSERT INTO "herobm_core"."casbin_rule" ("ptype", "v0", "v1", "v2", "v3")
SELECT ptype, v0, v1, v2, v3 FROM (
  VALUES
    -- viewer read access
    ('p', 'viewer', 'customers', 'read', 'allow'),
    ('p', 'viewer', 'products', 'read', 'allow'),
    ('p', 'viewer', 'inventory', 'read', 'allow'),
    ('p', 'viewer', 'sales-orders', 'read', 'allow'),
    ('p', 'viewer', 'sales-returns', 'read', 'allow'),
    ('p', 'viewer', 'sales-credit-notes', 'read', 'allow'),
    ('p', 'viewer', 'purchase-orders', 'read', 'allow'),
    ('p', 'viewer', 'purchase-returns', 'read', 'allow'),
    ('p', 'viewer', 'purchase-debit-notes', 'read', 'allow'),
    ('p', 'viewer', 'suppliers', 'read', 'allow'),
    ('p', 'viewer', 'receptions', 'read', 'allow'),
    ('p', 'viewer', 'goods-received', 'read', 'allow'),
    ('p', 'viewer', 'work-orders', 'read', 'allow'),
    ('p', 'viewer', 'crm', 'read', 'allow'),
    ('p', 'viewer', 'dashboard', 'read', 'allow'),
    ('p', 'viewer', 'tax-categories', 'read', 'allow'),
    ('p', 'viewer', 'settings', 'read', 'allow'),
    ('p', 'viewer', 'report', 'read', 'allow'),
    ('p', 'viewer', 'business_report', 'read', 'allow'),
    ('p', 'viewer', 'payments', 'read', 'allow'),
    ('p', 'viewer', 'credit-control', 'read', 'allow'),
    ('p', 'viewer', 'fiscal-periods', 'read', 'allow'),

    -- admin full access
    ('p', 'admin', 'dashboard', 'read', 'allow'),
    ('p', 'admin', 'dashboard', 'write', 'allow'),
    ('p', 'admin', 'customers', 'read', 'allow'),
    ('p', 'admin', 'customers', 'write', 'allow'),
    ('p', 'admin', 'customers', 'archive', 'allow'),
    ('p', 'admin', 'crm', 'read', 'allow'),
    ('p', 'admin', 'crm', 'write', 'allow'),
    ('p', 'admin', 'crm', 'archive', 'allow'),
    ('p', 'admin', 'crm', 'delete', 'allow'),
    ('p', 'admin', 'products', 'read', 'allow'),
    ('p', 'admin', 'products', 'write', 'allow'),
    ('p', 'admin', 'products', 'archive', 'allow'),
    ('p', 'admin', 'sales-orders', 'read', 'allow'),
    ('p', 'admin', 'sales-orders', 'write', 'allow'),
    ('p', 'admin', 'sales-orders', 'archive', 'allow'),
    ('p', 'admin', 'sales-orders', 'handle', 'allow'),
    ('p', 'admin', 'sales-orders', 'invoice', 'allow'),
    ('p', 'admin', 'sales-returns', 'read', 'allow'),
    ('p', 'admin', 'sales-returns', 'write', 'allow'),
    ('p', 'admin', 'sales-returns', 'archive', 'allow'),
    ('p', 'admin', 'sales-returns', 'handle', 'allow'),
    ('p', 'admin', 'sales-returns', 'invoice', 'allow'),
    ('p', 'admin', 'sales-credit-notes', 'read', 'allow'),
    ('p', 'admin', 'sales-credit-notes', 'write', 'allow'),
    ('p', 'admin', 'sales-credit-notes', 'archive', 'allow'),
    ('p', 'admin', 'sales-credit-notes', 'invoice', 'allow'),
    ('p', 'admin', 'purchase-orders', 'read', 'allow'),
    ('p', 'admin', 'purchase-orders', 'write', 'allow'),
    ('p', 'admin', 'purchase-orders', 'archive', 'allow'),
    ('p', 'admin', 'purchase-orders', 'handle', 'allow'),
    ('p', 'admin', 'purchase-orders', 'invoice', 'allow'),
    ('p', 'admin', 'work-orders', 'read', 'allow'),
    ('p', 'admin', 'work-orders', 'write', 'allow'),
    ('p', 'admin', 'work-orders', 'archive', 'allow'),
    ('p', 'admin', 'work-orders', 'handle', 'allow'),
    ('p', 'admin', 'purchase-returns', 'read', 'allow'),
    ('p', 'admin', 'purchase-returns', 'write', 'allow'),
    ('p', 'admin', 'purchase-returns', 'archive', 'allow'),
    ('p', 'admin', 'purchase-returns', 'handle', 'allow'),
    ('p', 'admin', 'purchase-returns', 'invoice', 'allow'),
    ('p', 'admin', 'purchase-debit-notes', 'read', 'allow'),
    ('p', 'admin', 'purchase-debit-notes', 'write', 'allow'),
    ('p', 'admin', 'purchase-debit-notes', 'archive', 'allow'),
    ('p', 'admin', 'purchase-debit-notes', 'handle', 'allow'),
    ('p', 'admin', 'purchase-debit-notes', 'invoice', 'allow'),
    ('p', 'admin', 'suppliers', 'read', 'allow'),
    ('p', 'admin', 'suppliers', 'write', 'allow'),
    ('p', 'admin', 'suppliers', 'archive', 'allow'),
    ('p', 'admin', 'receptions', 'read', 'allow'),
    ('p', 'admin', 'receptions', 'write', 'allow'),
    ('p', 'admin', 'receptions', 'archive', 'allow'),
    ('p', 'admin', 'goods-received', 'read', 'allow'),
    ('p', 'admin', 'goods-received', 'write', 'allow'),
    ('p', 'admin', 'goods-received', 'archive', 'allow'),
    ('p', 'admin', 'goods-received', 'handle', 'allow'),
    ('p', 'admin', 'inventory', 'read', 'allow'),
    ('p', 'admin', 'inventory', 'write', 'allow'),
    ('p', 'admin', 'inventory', 'archive', 'allow'),
    ('p', 'admin', 'inventory', 'handle', 'allow'),
    ('p', 'admin', 'users', 'read', 'allow'),
    ('p', 'admin', 'users', 'write', 'allow'),
    ('p', 'admin', 'users', 'archive', 'allow'),
    ('p', 'admin', 'roles', 'read', 'allow'),
    ('p', 'admin', 'roles', 'write', 'allow'),
    ('p', 'admin', 'roles', 'archive', 'allow'),
    ('p', 'admin', 'settings', 'read', 'allow'),
    ('p', 'admin', 'settings', 'write', 'allow'),
    ('p', 'admin', 'settings', 'archive', 'allow'),
    ('p', 'admin', 'gl', 'read', 'allow'),
    ('p', 'admin', 'gl', 'write', 'allow'),
    ('p', 'admin', 'fiscal-periods', 'read', 'allow'),
    ('p', 'admin', 'fiscal-periods', 'write', 'allow'),
    ('p', 'admin', 'payments', 'read', 'allow'),
    ('p', 'admin', 'payments', 'write', 'allow'),
    ('p', 'admin', 'payments', 'archive', 'allow'),
    ('p', 'admin', 'credit-control', 'read', 'allow'),
    ('p', 'admin', 'credit-control', 'write', 'allow'),
    ('p', 'admin', 'report', 'read', 'allow'),
    ('p', 'admin', 'report', 'write', 'allow'),
    ('p', 'admin', 'report', 'archive', 'allow'),
    ('p', 'admin', 'business_report', 'read', 'allow'),
    ('p', 'admin', 'business_report', 'write', 'allow'),
    ('p', 'admin', 'business_report', 'archive', 'allow'),
    ('p', 'admin', 'system_logs', 'read', 'allow'),
    ('p', 'admin', 'system_logs', 'write', 'allow'),
    ('p', 'admin', 'system_logs', 'archive', 'allow'),
    ('p', 'admin', 'setup', 'read', 'allow'),
    ('p', 'admin', 'setup', 'execute', 'allow'),
    ('p', 'admin', 'import', 'read', 'allow'),
    ('p', 'admin', 'import', 'write', 'allow'),
    ('p', 'admin', 'import', 'archive', 'allow'),
    ('p', 'admin', 'api_keys', 'read', 'allow'),
    ('p', 'admin', 'api_keys', 'write', 'allow'),
    ('p', 'admin', 'api_keys', 'archive', 'allow'),
    ('p', 'admin', 'webhooks', 'read', 'allow'),
    ('p', 'admin', 'webhooks', 'write', 'allow'),
    ('p', 'admin', 'webhooks', 'archive', 'allow'),
    ('p', 'admin', 'events', 'read', 'allow'),
    ('p', 'admin', 'events', 'write', 'allow'),
    ('p', 'admin', 'events', 'archive', 'allow'),
    ('p', 'admin', 'data-export', 'read', 'allow'),
    ('p', 'admin', 'data-export', 'write', 'allow'),

    -- finance access
    ('p', 'finance', 'credit-control', 'read', 'allow'),
    ('p', 'finance', 'credit-control', 'write', 'allow'),
    ('p', 'finance', 'gl', 'read', 'allow'),
    ('p', 'finance', 'gl', 'write', 'allow'),
    ('p', 'finance', 'fiscal-periods', 'read', 'allow'),
    ('p', 'finance', 'fiscal-periods', 'write', 'allow'),
    ('p', 'finance', 'payments', 'write', 'allow'),
    ('p', 'finance', 'sales-orders', 'invoice', 'allow'),
    ('p', 'finance', 'purchase-orders', 'invoice', 'allow'),
    ('p', 'finance', 'sales-returns', 'invoice', 'allow'),
    ('p', 'finance', 'purchase-returns', 'invoice', 'allow'),
    ('p', 'finance', 'purchase-debit-notes', 'read', 'allow'),
    ('p', 'finance', 'purchase-debit-notes', 'write', 'allow'),
    ('p', 'finance', 'purchase-debit-notes', 'invoice', 'allow'),
    ('p', 'finance', 'sales-credit-notes', 'read', 'allow'),
    ('p', 'finance', 'sales-credit-notes', 'invoice', 'allow')
) AS v(ptype, v0, v1, v2, v3)
WHERE NOT EXISTS (
  SELECT 1 FROM "herobm_core"."casbin_rule" c
  WHERE c.ptype = v.ptype
    AND c.v0 = v.v0
    AND c.v1 = v.v1
    AND c.v2 = v.v2
    AND c.v3 = v.v3
);

