CREATE OR REPLACE VIEW herobm_core.dashboard_timeline AS
SELECT event_id, 'sales_order' AS aggregate_type, sales_order_id AS aggregate_id, event_type, payload, actor, created_on FROM herobm_core.order_events
UNION ALL
SELECT event_id, 'purchase_order', purchase_order_id, event_type, payload, actor, created_on FROM herobm_core.purchase_order_events
UNION ALL
SELECT event_id, 'shipment', shipment_id, event_type, payload, actor, created_on FROM herobm_core.shipment_events
UNION ALL
SELECT event_id, 'transfer_order', transfer_order_id, event_type, payload, actor, created_on FROM herobm_core.transfer_order_events
UNION ALL
SELECT event_id, 'product', product_id, event_type, payload, actor, created_on FROM herobm_core.product_events
UNION ALL
SELECT event_id, 'customer', customer_id, event_type, payload, actor, created_on FROM herobm_core.customer_events
UNION ALL
SELECT event_id, 'supplier', vendor_id, event_type, payload, actor, created_on FROM herobm_core.supplier_events
UNION ALL
SELECT event_id, 'product_supplier', product_supplier_id, event_type, payload, actor, created_on FROM herobm_core.product_supplier_events
UNION ALL
SELECT event_id, 'user', user_id, event_type, payload, actor, created_on FROM herobm_core.user_events
UNION ALL
SELECT event_id, 'payment', payment_id, event_type, payload, actor, created_on FROM herobm_core.payment_events
UNION ALL
SELECT event_id, aggregate_type, aggregate_id, event_type, payload, actor, created_on FROM herobm_core.system_events;
