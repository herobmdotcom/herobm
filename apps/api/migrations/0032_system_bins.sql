-- 0032_system_bins.sql

-- Define deterministic UUIDs for system staging bins to allow easy hardcoding
-- SHIPPING bin for Sales Order Pick & Ship workflow
INSERT INTO modbm_core.bins (bin_id, bin_number, location_no, bin_type, is_unavailable, source, created_by)
VALUES 
  ('00000000-0000-4000-b000-000000000001', 'SHIPPING', 'MAIN', 'staging', true, 'system', 'system'),
  ('00000000-0000-4000-b000-000000000002', 'DOCK', 'MAIN', 'staging', true, 'system', 'system')
ON CONFLICT (bin_number, location_no) DO NOTHING;
