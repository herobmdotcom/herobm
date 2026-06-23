ALTER TABLE "herobm_core"."customer_groups" ADD COLUMN "early_payment_discount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."customer_groups" ADD COLUMN "early_payment_discount_days" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD COLUMN "early_payment_discount" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."customers" ADD COLUMN "early_payment_discount_days" integer;