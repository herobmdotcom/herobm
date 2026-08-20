ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD COLUMN IF NOT EXISTS "discount_percentage" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD COLUMN IF NOT EXISTS "product_number" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD COLUMN IF NOT EXISTS "product_name" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD COLUMN IF NOT EXISTS "product_number" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD COLUMN IF NOT EXISTS "product_name" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD COLUMN IF NOT EXISTS "price_per_unit" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD COLUMN IF NOT EXISTS "discount_percentage" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_return_lines" ADD COLUMN IF NOT EXISTS "tax_category_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."sales_order_return_lines" ADD CONSTRAINT "sales_order_return_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;