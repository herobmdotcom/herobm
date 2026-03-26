ALTER TABLE "modbm_core"."purchase_orders" ADD COLUMN "delivery_location_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_orders" ADD CONSTRAINT "purchase_orders_delivery_location_id_locations_location_id_fk" FOREIGN KEY ("delivery_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Create trigger function
CREATE OR REPLACE FUNCTION modbm_core.trg_scaffold_system_bins()
RETURNS TRIGGER AS $$
DECLARE
    handling_zone_id UUID;
BEGIN
    handling_zone_id := gen_random_uuid();
    INSERT INTO modbm_core.zones (zone_id, location_id, code, name, source, created_by)
    VALUES (handling_zone_id, NEW.location_id, 'HANDLING', 'Handling Zone', 'system', 'system');

    INSERT INTO modbm_core.bins (bin_number, zone_id, bin_type, source, is_unavailable, created_by)
    VALUES 
        ('SHIPPING', handling_zone_id, 'staging', 'system', true, 'system'),
        ('RECEIVING', handling_zone_id, 'staging', 'system', true, 'system');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

-- Attach trigger
CREATE TRIGGER scaffold_handling_bins
AFTER INSERT ON modbm_core.locations
FOR EACH ROW EXECUTE FUNCTION modbm_core.trg_scaffold_system_bins();--> statement-breakpoint

-- Retroactively create HANDLING zones and bins for all existing locations
DO $$ 
DECLARE 
    loc RECORD;
    handling_zone_id UUID;
    existing_shipping_bin_id UUID;
    existing_dock_bin_id UUID;
BEGIN 
    FOR loc IN SELECT location_id FROM modbm_core.locations LOOP 
        -- Ensure HANDLING zone exists
        SELECT zone_id INTO handling_zone_id FROM modbm_core.zones WHERE location_id = loc.location_id AND code = 'HANDLING';
        
        IF handling_zone_id IS NULL THEN
            handling_zone_id := gen_random_uuid();
            INSERT INTO modbm_core.zones (zone_id, location_id, code, name, source, created_by)
            VALUES (handling_zone_id, loc.location_id, 'HANDLING', 'Handling Zone', 'system', 'system');
        END IF;

        -- Check for existing SHIPPING bin anywhere in this location
        SELECT b.bin_id INTO existing_shipping_bin_id 
        FROM modbm_core.bins b 
        JOIN modbm_core.zones z ON b.zone_id = z.zone_id 
        WHERE z.location_id = loc.location_id AND b.bin_number = 'SHIPPING' AND b.source = 'system'
        LIMIT 1;

        IF existing_shipping_bin_id IS NOT NULL THEN
            UPDATE modbm_core.bins SET zone_id = handling_zone_id WHERE bin_id = existing_shipping_bin_id;
        ELSE
            IF NOT EXISTS (SELECT 1 FROM modbm_core.bins WHERE zone_id = handling_zone_id AND bin_number = 'SHIPPING') THEN
                INSERT INTO modbm_core.bins (bin_number, zone_id, bin_type, source, is_unavailable, created_by)
                VALUES ('SHIPPING', handling_zone_id, 'staging', 'system', true, 'system');
            END IF;
        END IF;

        -- Check for existing DOCK or RECEIVING system bin anywhere in this location
        SELECT b.bin_id INTO existing_dock_bin_id 
        FROM modbm_core.bins b 
        JOIN modbm_core.zones z ON b.zone_id = z.zone_id 
        WHERE z.location_id = loc.location_id AND (b.bin_number = 'DOCK' OR b.bin_number = 'RECEIVING') AND b.source = 'system'
        LIMIT 1;

        IF existing_dock_bin_id IS NOT NULL THEN
            UPDATE modbm_core.bins SET zone_id = handling_zone_id, bin_number = 'RECEIVING' WHERE bin_id = existing_dock_bin_id;
        ELSE
            IF NOT EXISTS (SELECT 1 FROM modbm_core.bins WHERE zone_id = handling_zone_id AND bin_number = 'RECEIVING') THEN
                INSERT INTO modbm_core.bins (bin_number, zone_id, bin_type, source, is_unavailable, created_by)
                VALUES ('RECEIVING', handling_zone_id, 'staging', 'system', true, 'system');
            END IF;
        END IF;

    END LOOP; 
END $$;
