ALTER TABLE "herobm_core"."exchange_rates" DROP CONSTRAINT "exchange_rates_currency_code_unique";--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD COLUMN "foreign_debit" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD COLUMN "foreign_credit" numeric DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD COLUMN "foreign_currency_code" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_lines" ADD COLUMN "exchange_rate" numeric DEFAULT '1';--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "realised_fx_gain_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "realised_fx_loss_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "unrealised_fx_gain_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN "unrealised_fx_loss_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_entries" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_entries" ADD COLUMN "base_unallocated_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."payment_entries" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD COLUMN "base_outstanding_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "base_outstanding_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "early_payment_discount" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_invoices" ADD COLUMN "early_payment_discount_days" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD COLUMN "base_outstanding_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "base_outstanding_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "early_payment_discount" numeric;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "early_payment_discount_days" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN "base_total_amount" numeric DEFAULT '0';--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_orders" ADD COLUMN "exchange_rate" numeric DEFAULT '1' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_realised_fx_gain_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("realised_fx_gain_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_realised_fx_loss_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("realised_fx_loss_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_unrealised_fx_gain_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("unrealised_fx_gain_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_unrealised_fx_loss_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("unrealised_fx_loss_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."exchange_rates" ADD CONSTRAINT "exchange_rates_currency_effective_date_unq" UNIQUE("currency_code","effective_date");