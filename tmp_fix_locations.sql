-- Fix duplicate Singapore location: merge SIN (seeded) into 1 (imported), then rename 1 → SIN
BEGIN;

-- Step 1: Re-point all FKs from SIN location to location 1
UPDATE modbm_core.sales_orders
  SET fulfillment_location_id = (SELECT location_id FROM modbm_core.locations WHERE code = '1')
  WHERE fulfillment_location_id = (SELECT location_id FROM modbm_core.locations WHERE code = 'SIN');

UPDATE modbm_core.sales_order_lines
  SET fulfillment_location_id = (SELECT location_id FROM modbm_core.locations WHERE code = '1')
  WHERE fulfillment_location_id = (SELECT location_id FROM modbm_core.locations WHERE code = 'SIN');

-- Step 2: Delete SIN's bin_contents, bins, zones, then the location itself
DELETE FROM modbm_core.bin_contents
  WHERE bin_id IN (
    SELECT bin_id FROM modbm_core.bins
    WHERE zone_id IN (
      SELECT zone_id FROM modbm_core.zones
      WHERE location_id = (SELECT location_id FROM modbm_core.locations WHERE code = 'SIN')
    )
  );

DELETE FROM modbm_core.bins
  WHERE zone_id IN (
    SELECT zone_id FROM modbm_core.zones
    WHERE location_id = (SELECT location_id FROM modbm_core.locations WHERE code = 'SIN')
  );

DELETE FROM modbm_core.zones
  WHERE location_id = (SELECT location_id FROM modbm_core.locations WHERE code = 'SIN');

DELETE FROM modbm_core.locations WHERE code = 'SIN';

-- Step 3: Rename location 1 → SIN
UPDATE modbm_core.locations SET code = 'SIN', name = 'Singapore' WHERE code = '1';

-- Verify
SELECT location_id, code, name, source_id FROM modbm_core.locations ORDER BY code;
SELECT l.code, count(b.bin_id) as bin_count
  FROM modbm_core.locations l
  LEFT JOIN modbm_core.zones z ON z.location_id = l.location_id
  LEFT JOIN modbm_core.bins b ON b.zone_id = z.zone_id
  GROUP BY l.code ORDER BY l.code;

COMMIT;
