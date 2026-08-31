-- Migration 0131: Extend Postgres immutability triggers across Tiers 1, 2, and 3

-- Tier 1: Perpetual Inventory Subledger & Bank Control
DROP TRIGGER IF EXISTS trg_protect_inventory_ledger ON herobm_core.inventory_ledger;--> statement-breakpoint
CREATE TRIGGER trg_protect_inventory_ledger
BEFORE DELETE ON herobm_core.inventory_ledger
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_goods_received ON herobm_core.goods_received;--> statement-breakpoint
CREATE TRIGGER trg_protect_goods_received
BEFORE DELETE ON herobm_core.goods_received
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_goods_received_lines ON herobm_core.goods_received_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_goods_received_lines
BEFORE DELETE ON herobm_core.goods_received_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_order_shipments ON herobm_core.sales_order_shipments;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_order_shipments
BEFORE DELETE ON herobm_core.sales_order_shipments
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_sales_order_shipment_lines ON herobm_core.sales_order_shipment_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_sales_order_shipment_lines
BEFORE DELETE ON herobm_core.sales_order_shipment_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_po_return_shipments ON herobm_core.purchase_order_return_shipments;--> statement-breakpoint
CREATE TRIGGER trg_protect_po_return_shipments
BEFORE DELETE ON herobm_core.purchase_order_return_shipments
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_po_return_shipment_lines ON herobm_core.purchase_order_return_shipment_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_po_return_shipment_lines
BEFORE DELETE ON herobm_core.purchase_order_return_shipment_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_transfer_order_shipments ON herobm_core.transfer_order_shipments;--> statement-breakpoint
CREATE TRIGGER trg_protect_transfer_order_shipments
BEFORE DELETE ON herobm_core.transfer_order_shipments
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_transfer_order_shipment_lines ON herobm_core.transfer_order_shipment_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_transfer_order_shipment_lines
BEFORE DELETE ON herobm_core.transfer_order_shipment_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_transfer_order_receipts ON herobm_core.transfer_order_receipts;--> statement-breakpoint
CREATE TRIGGER trg_protect_transfer_order_receipts
BEFORE DELETE ON herobm_core.transfer_order_receipts
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_transfer_order_receipt_lines ON herobm_core.transfer_order_receipt_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_transfer_order_receipt_lines
BEFORE DELETE ON herobm_core.transfer_order_receipt_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_bank_statement_lines ON herobm_core.bank_statement_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_bank_statement_lines
BEFORE DELETE ON herobm_core.bank_statement_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_gl_reconciliations ON herobm_core.gl_reconciliations;--> statement-breakpoint
CREATE TRIGGER trg_protect_gl_reconciliations
BEFORE DELETE ON herobm_core.gl_reconciliations
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_gl_match_groups ON herobm_core.gl_match_groups;--> statement-breakpoint
CREATE TRIGGER trg_protect_gl_match_groups
BEFORE DELETE ON herobm_core.gl_match_groups
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

-- Tier 2: Universal Domain Audit Logs
DROP TRIGGER IF EXISTS trg_protect_procurement_events ON herobm_core.procurement_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_procurement_events
BEFORE DELETE ON herobm_core.procurement_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_inventory_events ON herobm_core.inventory_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_inventory_events
BEFORE DELETE ON herobm_core.inventory_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_warehouse_events ON herobm_core.warehouse_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_warehouse_events
BEFORE DELETE ON herobm_core.warehouse_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_master_data_events ON herobm_core.master_data_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_master_data_events
BEFORE DELETE ON herobm_core.master_data_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_user_events ON herobm_core.user_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_user_events
BEFORE DELETE ON herobm_core.user_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_reconciliation_events ON herobm_core.reconciliation_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_reconciliation_events
BEFORE DELETE ON herobm_core.reconciliation_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_group_events ON herobm_core.group_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_group_events
BEFORE DELETE ON herobm_core.group_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_email_events ON herobm_core.email_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_email_events
BEFORE DELETE ON herobm_core.email_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_business_report_events ON herobm_core.business_report_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_business_report_events
BEFORE DELETE ON herobm_core.business_report_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_integration_events ON herobm_core.integration_events;--> statement-breakpoint
CREATE TRIGGER trg_protect_integration_events
BEFORE DELETE ON herobm_core.integration_events
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

-- Tier 3: Historical Financial Parameters
DROP TRIGGER IF EXISTS trg_protect_exchange_rates ON herobm_core.exchange_rates;--> statement-breakpoint
CREATE TRIGGER trg_protect_exchange_rates
BEFORE DELETE ON herobm_core.exchange_rates
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_gl_fiscal_periods ON herobm_core.gl_fiscal_periods;--> statement-breakpoint
CREATE TRIGGER trg_protect_gl_fiscal_periods
BEFORE DELETE ON herobm_core.gl_fiscal_periods
FOR EACH ROW EXECUTE FUNCTION herobm_core.prevent_financial_deletion();
