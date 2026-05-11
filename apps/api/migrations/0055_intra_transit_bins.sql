-- Migration: Add INTRA_TRANSIT bin to existing locations

DO $$
DECLARE
    z RECORD;
BEGIN
    FOR z IN SELECT zone_id FROM modbm_core.zones WHERE code = 'HANDLING' LOOP
        IF NOT EXISTS (SELECT 1 FROM modbm_core.bins WHERE zone_id = z.zone_id AND bin_number = 'INTRA_TRANSIT') THEN
            INSERT INTO modbm_core.bins (bin_number, zone_id, bin_type, source, is_unavailable, created_by)
            VALUES ('INTRA_TRANSIT', z.zone_id, 'in_transit', 'system', true, 'system');
        END IF;
    END LOOP;
END;
$$ LANGUAGE plpgsql;
