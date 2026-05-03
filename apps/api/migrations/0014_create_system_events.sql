CREATE TABLE "modbm_core"."system_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aggregate_type" text NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);

CREATE OR REPLACE VIEW modbm_core.dashboard_timeline AS SELECT event_id, 'sales_order' AS aggregate_type, sales_order_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.order_events UNION ALL SELECT event_id, 'purchase_order' AS aggregate_type, purchase_order_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.purchase_order_events UNION ALL SELECT event_id, 'product' AS aggregate_type, product_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.product_events UNION ALL SELECT event_id, 'account' AS aggregate_type, account_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.account_events UNION ALL SELECT event_id, 'supplier' AS aggregate_type, vendor_id AS aggregate_id, event_type, payload, actor, created_on FROM modbm_core.supplier_events UNION ALL SELECT event_id, aggregate_type, aggregate_id, event_type, payload, actor, created_on FROM modbm_core.system_events;
