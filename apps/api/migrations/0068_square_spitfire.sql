ALTER TABLE "herobm_core"."customer_groups" ADD COLUMN "default_discount_percentage" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD COLUMN "parent_customer_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD COLUMN "customer_discount" numeric;