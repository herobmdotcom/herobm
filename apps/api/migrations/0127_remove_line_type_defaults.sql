ALTER TABLE "herobm_core"."purchase_order_lines" ALTER COLUMN "line_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_order_lines" ALTER COLUMN "line_type" DROP DEFAULT;