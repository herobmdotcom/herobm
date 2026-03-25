-- 0030_po_uuids.sql
-- Enforce UUIDs on purchase orders to allow foreign keys to products and suppliers.

-- Clean up any orphaned records before enforcing strict FK constraints
-- Instead of deleting POs (which breaks AP invoices and GL), we just NULL out the invalid references.

UPDATE "modbm_core"."purchase_orders" 
SET "vendor_id" = NULL 
WHERE "vendor_id" IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "modbm_core"."suppliers" s WHERE s."vendor_id" = "purchase_orders"."vendor_id"::uuid);

UPDATE "modbm_core"."purchase_order_lines" 
SET "product_id" = NULL 
WHERE "product_id" IS NOT NULL 
  AND NOT EXISTS (SELECT 1 FROM "modbm_core"."products" p WHERE p."product_id" = "purchase_order_lines"."product_id"::uuid);

DO $$ BEGIN

    -- 1. purchase_orders.vendor_id -> UUID + FK to suppliers
    -- The table might be empty or might have UI-generated UUIDs stored as text.
    -- If there's any ABM legacy text IDs (there shouldn't be since seed.py didn't seed them), this will fail safely.
    ALTER TABLE "modbm_core"."purchase_orders" 
        ALTER COLUMN "vendor_id" TYPE uuid USING "vendor_id"::uuid;
        
    ALTER TABLE "modbm_core"."purchase_orders" 
        ADD CONSTRAINT "purchase_orders_vendor_id_suppliers_vendor_id_fk" 
        FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") 
        ON DELETE no action ON UPDATE no action;

    -- 2. purchase_order_lines.product_id -> UUID + FK to products
    ALTER TABLE "modbm_core"."purchase_order_lines" 
        ALTER COLUMN "product_id" TYPE uuid USING "product_id"::uuid;

    ALTER TABLE "modbm_core"."purchase_order_lines" 
        ADD CONSTRAINT "purchase_order_lines_product_id_products_product_id_fk" 
        FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") 
        ON DELETE no action ON UPDATE no action;

EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
