CREATE OR REPLACE VIEW modbm_core.dashboard_timeline AS
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.sales_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.procurement_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.warehouse_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.master_data_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.financial_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.inventory_events
UNION ALL
SELECT event_id, entity_type, entity_id, event_type, payload, actor, created_on FROM modbm_core.system_events
UNION ALL
SELECT event_id, 'user' AS entity_type, user_id AS entity_id, event_type, payload, actor, created_on FROM modbm_core.user_events;
