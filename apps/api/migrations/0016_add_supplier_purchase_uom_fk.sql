ALTER TABLE "herobm_core"."product_suppliers" ADD COLUMN IF NOT EXISTS "purchase_uom_id" uuid;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_purchase_uom_id_product_uoms_product_uom_id_fk'
    ) THEN
        ALTER TABLE "herobm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_purchase_uom_id_product_uoms_product_uom_id_fk" FOREIGN KEY ("purchase_uom_id") REFERENCES "herobm_core"."product_uoms"("product_uom_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
INSERT INTO herobm_core.product_uoms (product_uom_id, product_id, uom_code, ratio, barcode, is_sales_default, is_purchase_default)
SELECT 
    gen_random_uuid(),
    p.product_id,
    p.base_uom,
    1.0000,
    NULL,
    true,
    true
FROM herobm_core.products p
WHERE NOT EXISTS (
    SELECT 1 FROM herobm_core.product_uoms pu WHERE pu.product_id = p.product_id
) ON CONFLICT DO NOTHING;--> statement-breakpoint
UPDATE herobm_core.product_suppliers ps
SET purchase_uom_id = COALESCE(
    p.default_purchase_uom_id,
    (SELECT pu.product_uom_id FROM herobm_core.product_uoms pu WHERE pu.product_id = ps.product_id AND pu.is_purchase_default = true LIMIT 1),
    (SELECT pu.product_uom_id FROM herobm_core.product_uoms pu WHERE pu.product_id = ps.product_id AND pu.uom_code = p.base_uom LIMIT 1),
    (SELECT pu.product_uom_id FROM herobm_core.product_uoms pu WHERE pu.product_id = ps.product_id LIMIT 1)
)
FROM herobm_core.products p
WHERE ps.product_id = p.product_id
  AND ps.purchase_uom_id IS NULL;