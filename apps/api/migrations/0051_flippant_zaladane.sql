ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "default_discounts_received_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_allocations" ADD COLUMN "discount_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."supplier_groups" ADD COLUMN "early_payment_discount_days" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."suppliers" ADD COLUMN "early_payment_discount_days" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_discounts_received_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_discounts_received_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;