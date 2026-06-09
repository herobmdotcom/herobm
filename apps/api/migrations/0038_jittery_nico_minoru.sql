ALTER TABLE "modbm_core"."financial_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."master_data_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."outbox" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."procurement_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."system_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."user_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."warehouse_events" ADD COLUMN "entity_display_name" text;--> statement-breakpoint

UPDATE modbm_core.sales_events e SET entity_display_name = so.order_number FROM modbm_core.sales_orders so WHERE e.entity_type = 'sales_order' AND e.entity_id = so.sales_order_id;--> statement-breakpoint
UPDATE modbm_core.procurement_events e SET entity_display_name = po.order_number FROM modbm_core.purchase_orders po WHERE e.entity_type = 'purchase_order' AND e.entity_id = po.purchase_order_id;--> statement-breakpoint
UPDATE modbm_core.master_data_events e SET entity_display_name = a.name FROM modbm_core.customers a WHERE e.entity_type = 'customer' AND e.entity_id = a.customer_id;--> statement-breakpoint
UPDATE modbm_core.master_data_events e SET entity_display_name = s.name FROM modbm_core.suppliers s WHERE e.entity_type = 'supplier' AND e.entity_id = s.vendor_id;--> statement-breakpoint
UPDATE modbm_core.master_data_events e SET entity_display_name = p.name FROM modbm_core.products p WHERE e.entity_type = 'product' AND e.entity_id = p.product_id;--> statement-breakpoint
UPDATE modbm_core.warehouse_events e SET entity_display_name = gr.receipt_number FROM modbm_core.goods_received gr WHERE e.entity_type = 'goods_receipt' AND e.entity_id = gr.goods_received_id;--> statement-breakpoint
UPDATE modbm_core.warehouse_events e SET entity_display_name = to_tbl.order_number FROM modbm_core.transfer_orders to_tbl WHERE e.entity_type = 'transfer_order' AND e.entity_id = to_tbl.transfer_order_id;--> statement-breakpoint
UPDATE modbm_core.financial_events e SET entity_display_name = pe.payment_number FROM modbm_core.payment_entries pe WHERE e.entity_type = 'payment' AND e.entity_id = pe.payment_id;--> statement-breakpoint
UPDATE modbm_core.inventory_events e SET entity_display_name = ie.entry_number FROM modbm_core.inventory_entries ie WHERE e.entity_type = 'inventory_ledger' AND e.entity_id = ie.entry_id;--> statement-breakpoint
UPDATE modbm_core.user_events e SET entity_display_name = u.display_name FROM modbm_core.users u WHERE e.user_id = u.user_id;--> statement-breakpoint

UPDATE modbm_core.sales_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.procurement_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.warehouse_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.master_data_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.financial_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.inventory_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.system_events SET entity_display_name = entity_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint
UPDATE modbm_core.user_events SET entity_display_name = user_id::text WHERE entity_display_name IS NULL;--> statement-breakpoint

DROP VIEW IF EXISTS modbm_core.dashboard_timeline;--> statement-breakpoint
CREATE VIEW modbm_core.dashboard_timeline AS
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.sales_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.procurement_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.warehouse_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.master_data_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.financial_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.inventory_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.system_events
UNION ALL
SELECT event_id, 'user' AS entity_type, user_id AS entity_id, event_type, entity_display_name, payload, actor, created_on FROM modbm_core.user_events;