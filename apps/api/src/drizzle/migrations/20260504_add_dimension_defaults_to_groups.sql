-- Migration: Add financial dimension defaults to routing groups
-- Adds defaultCostCenterId and defaultActivityId to account_groups, 
-- supplier_groups, and product_groups for automatic GL dimension routing.

ALTER TABLE modbm_core.account_groups
  ADD COLUMN IF NOT EXISTS default_cost_center_id UUID
    REFERENCES modbm_core.cost_centers(cost_center_id),
  ADD COLUMN IF NOT EXISTS default_activity_id UUID
    REFERENCES modbm_core.activities(activity_id);

ALTER TABLE modbm_core.supplier_groups
  ADD COLUMN IF NOT EXISTS default_cost_center_id UUID
    REFERENCES modbm_core.cost_centers(cost_center_id),
  ADD COLUMN IF NOT EXISTS default_activity_id UUID
    REFERENCES modbm_core.activities(activity_id);

ALTER TABLE modbm_core.product_groups
  ADD COLUMN IF NOT EXISTS default_cost_center_id UUID
    REFERENCES modbm_core.cost_centers(cost_center_id),
  ADD COLUMN IF NOT EXISTS default_activity_id UUID
    REFERENCES modbm_core.activities(activity_id);
