ALTER TABLE "herobm_core"."purchase_order_lines" ALTER COLUMN "tax_category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ALTER COLUMN "tax_category_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ALTER COLUMN "fulfillment_location_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_lines" ADD COLUMN "line_type" text DEFAULT 'Product' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD COLUMN "line_type" text DEFAULT 'Product' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_product_check" CHECK ((line_type = 'Product' AND tax_category_id IS NOT NULL) OR line_type = 'Comment');--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ADD CONSTRAINT "sales_order_lines_product_check" CHECK ((line_type = 'Product' AND tax_category_id IS NOT NULL AND fulfillment_location_id IS NOT NULL) OR line_type = 'Comment');