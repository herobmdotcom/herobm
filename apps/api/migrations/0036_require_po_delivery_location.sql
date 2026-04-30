-- Fix legacy records in AU using raw ABM data where possible
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = 'raw_abm') THEN
        UPDATE "modbm_core"."purchase_orders" po
        SET "delivery_location_id" = loc.location_id
        FROM (
            SELECT 
                h.trading_ref as document_number,
                MAX(d.location_no) as abm_location_no
            FROM raw_abm.transheaders h
            JOIN raw_abm.transdetails d ON h.transaction_id = d.transaction_id
            WHERE h.transaction_type IN ('PS', 'PT')
            GROUP BY h.trading_ref
        ) pl
        JOIN "modbm_core"."locations" loc ON loc.source_id = pl.abm_location_no::text
        WHERE po."delivery_location_id" IS NULL 
        AND trim(po."order_number") = trim(pl.document_number);
    END IF;
END $$;

-- Fallback for AU: Albury NSW
UPDATE "modbm_core"."purchase_orders" 
SET "delivery_location_id" = '771bc4cf-d27c-4960-b793-1eb26bbbbd68' 
WHERE "delivery_location_id" IS NULL 
AND EXISTS (SELECT 1 FROM "modbm_core"."locations" WHERE "location_id" = '771bc4cf-d27c-4960-b793-1eb26bbbbd68');

-- Fallback for SG: Singapore Warehouse
UPDATE "modbm_core"."purchase_orders" 
SET "delivery_location_id" = '5c981225-9d90-4335-b711-26a5f0611618' 
WHERE "delivery_location_id" IS NULL 
AND EXISTS (SELECT 1 FROM "modbm_core"."locations" WHERE "location_id" = '5c981225-9d90-4335-b711-26a5f0611618');

-- Final safety check: if any are still NULL (e.g. in a dev DB without the above locations), 
-- assign to the first available location to prevent migration failure.
UPDATE "modbm_core"."purchase_orders"
SET "delivery_location_id" = (SELECT location_id FROM "modbm_core"."locations" LIMIT 1)
WHERE "delivery_location_id" IS NULL;

ALTER TABLE "modbm_core"."purchase_orders" ALTER COLUMN "delivery_location_id" SET NOT NULL;