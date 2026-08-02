
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD COLUMN "customer_name_display" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_invoices" ADD CONSTRAINT "sales_invoices_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;