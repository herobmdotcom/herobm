CREATE TABLE IF NOT EXISTS "modbm_core"."shipment_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."shipment_events" ADD CONSTRAINT "shipment_events_shipment_id_sales_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."sales_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE OR REPLACE VIEW modbm_core.dashboard_timeline AS
SELECT event_id, 'sales_order' AS aggregate_type, sales_order_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.order_events
UNION ALL
SELECT event_id, 'purchase_order' AS aggregate_type, purchase_order_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.purchase_order_events
UNION ALL
SELECT event_id, 'product' AS aggregate_type, product_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.product_events
UNION ALL
SELECT event_id, 'account' AS aggregate_type, account_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.account_events
UNION ALL
SELECT event_id, 'supplier' AS aggregate_type, vendor_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.supplier_events
UNION ALL
SELECT event_id, 'product_supplier' AS aggregate_type, product_supplier_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.product_supplier_events
UNION ALL
SELECT event_id, 'shipment' AS aggregate_type, shipment_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.shipment_events
UNION ALL
SELECT event_id, aggregate_type, aggregate_id, event_type, payload, actor, created_on FROM modbm_core.system_events;