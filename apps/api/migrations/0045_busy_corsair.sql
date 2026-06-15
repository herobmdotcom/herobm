ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "default_trading_terms_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "invoice_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "terms_description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD COLUMN "terms_description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "invoice_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "due_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "terms_description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN "terms_description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN "credit_hold_override_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN "credit_hold_override_by" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN "credit_hold_override_reason" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD CONSTRAINT "app_settings_default_trading_terms_id_trading_terms_trading_terms_id_fk" FOREIGN KEY ("default_trading_terms_id") REFERENCES "herobm_core"."trading_terms"("trading_terms_id") ON DELETE no action ON UPDATE no action;