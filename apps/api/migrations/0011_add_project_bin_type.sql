ALTER TYPE "herobm_core"."bin_type_enum" ADD VALUE IF NOT EXISTS 'project';--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ALTER COLUMN "sales_order_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ALTER COLUMN "sales_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD COLUMN IF NOT EXISTS "description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD COLUMN IF NOT EXISTS "product_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD COLUMN IF NOT EXISTS "gl_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD COLUMN IF NOT EXISTS "project_ledger_entry_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN IF NOT EXISTS "project_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."project_budget_lines" ADD COLUMN IF NOT EXISTS "discount_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "herobm_core"."project_ledger_entries" ADD COLUMN IF NOT EXISTS "discount_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD COLUMN IF NOT EXISTS "discount_percentage" numeric(5, 2);--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "herobm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoice_lines" ADD CONSTRAINT "sales_invoice_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD CONSTRAINT "sales_invoices_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_invoice_lines_ledger_id" ON "herobm_core"."sales_invoice_lines" USING btree ("project_ledger_entry_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_invoices_project_id" ON "herobm_core"."sales_invoices" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_invoices_customer_id" ON "herobm_core"."sales_invoices" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_sales_invoices_order_id" ON "herobm_core"."sales_invoices" USING btree ("sales_order_id");