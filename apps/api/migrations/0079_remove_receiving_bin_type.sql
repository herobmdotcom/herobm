-- 1. Ensure no existing rows use 'receiving' by changing them to 'staging'
UPDATE "herobm_core"."bins" SET "bin_type" = 'staging' WHERE "bin_type" = 'receiving';

-- 2. Drop the dependent view
DROP VIEW IF EXISTS "herobm_core"."inventory_levels";

-- 3. Rename the old enum type
ALTER TYPE "herobm_core"."bin_type_enum" RENAME TO "bin_type_enum_old";

-- 4. Create the new enum type without 'receiving'
CREATE TYPE "herobm_core"."bin_type_enum" AS ENUM('storage', 'pick', 'bulk', 'staging', 'quarantine', 'in_transit');

-- 5. Update the columns using the enum to the new type
ALTER TABLE "herobm_core"."bins" ALTER COLUMN "bin_type" DROP DEFAULT;
ALTER TABLE "herobm_core"."bins" ALTER COLUMN "bin_type" TYPE "herobm_core"."bin_type_enum" USING "bin_type"::text::"herobm_core"."bin_type_enum";

-- 6. Drop the old enum type
DROP TYPE "herobm_core"."bin_type_enum_old";

-- 7. Recreate the view without 'receiving' in the filter array
CREATE VIEW "herobm_core"."inventory_levels" AS
 SELECT gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(( SELECT sum(bc.actual_quantity) AS sum
           FROM herobm_core.bin_contents bc
             JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
             JOIN herobm_core.zones z ON z.zone_id = b.zone_id
          WHERE bc.product_id = p.product_id AND z.location_id = l.location_id AND (b.bin_type <> ALL (ARRAY['staging'::herobm_core.bin_type_enum, 'quarantine'::herobm_core.bin_type_enum])) AND b.is_unavailable = false AND b.is_bonded = false), 0::numeric) AS quantity_on_hand,
    COALESCE((( SELECT COALESCE(sum(b.quantity), 0::numeric) AS coalesce
           FROM herobm_core.backorders b
             JOIN herobm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
          WHERE sol.product_id = p.product_id AND sol.fulfillment_location_id = l.location_id AND b.state_code = 'received_reserved'::text)) + (( SELECT COALESCE(sum(sol.quantity - COALESCE(( SELECT sum(sop.quantity) AS sum
                   FROM herobm_core.sales_order_picks sop
                  WHERE sop.sales_order_line_id = sol.sales_order_line_id), 0::numeric)), 0::numeric) AS coalesce
           FROM herobm_core.sales_order_lines sol
             JOIN herobm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
          WHERE sol.product_id = p.product_id AND sol.fulfillment_location_id = l.location_id AND (so.state_code = ANY (ARRAY['confirmed'::text, 'picking'::text, 'partially_picked'::text, 'packed'::text, 'partially_dispatched'::text])))), 0::numeric) AS quantity_committed,
    0 AS quantity_reserved,
    COALESCE(( SELECT sum(pol.quantity - pol.quantity_received) AS sum
           FROM herobm_core.purchase_order_lines pol
             JOIN herobm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id
          WHERE pol.product_id = p.product_id AND po.delivery_location_id = l.location_id AND (po.state_code <> ALL (ARRAY['draft'::text, 'cancelled'::text, 'completed'::text]))), 0::numeric) AS quantity_on_order
   FROM herobm_core.products p
     CROSS JOIN herobm_core.locations l;