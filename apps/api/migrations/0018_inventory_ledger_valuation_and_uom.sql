ALTER TABLE "herobm_core"."product_suppliers" ADD COLUMN IF NOT EXISTS "purchase_uom_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD COLUMN IF NOT EXISTS "unit_cost" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD COLUMN IF NOT EXISTS "total_value" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD COLUMN IF NOT EXISTS "uom_id" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."inventory_ledger" ADD COLUMN IF NOT EXISTS "original_quantity" numeric;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'product_suppliers_purchase_uom_id_product_uoms_product_uom_id_fk'
    ) THEN
        ALTER TABLE "herobm_core"."product_suppliers" ADD CONSTRAINT "product_suppliers_purchase_uom_id_product_uoms_product_uom_id_fk" FOREIGN KEY ("purchase_uom_id") REFERENCES "herobm_core"."product_uoms"("product_uom_id") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'inventory_ledger_uom_id_uom_dictionary_uom_code_fk'
    ) THEN
        ALTER TABLE "herobm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_uom_id_uom_dictionary_uom_code_fk" FOREIGN KEY ("uom_id") REFERENCES "herobm_core"."uom_dictionary"("uom_code") ON DELETE no action ON UPDATE no action;
    END IF;
END $$;--> statement-breakpoint

UPDATE herobm_core.inventory_ledger l
SET 
    uom_id = COALESCE(l.uom_id, p.base_uom),
    original_quantity = COALESCE(l.original_quantity, l.quantity),
    unit_cost = COALESCE(l.unit_cost, p.weighted_average_cost, p.standard_cost, 0),
    total_value = COALESCE(l.total_value, l.quantity * COALESCE(l.unit_cost, p.weighted_average_cost, p.standard_cost, 0))
FROM herobm_core.products p
WHERE l.product_id = p.product_id
  AND (l.uom_id IS NULL OR l.original_quantity IS NULL OR l.unit_cost IS NULL OR l.total_value IS NULL);