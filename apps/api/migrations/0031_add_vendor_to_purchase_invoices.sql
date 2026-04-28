ALTER TABLE "modbm_core"."purchase_invoice_lines" ALTER COLUMN "purchase_order_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ALTER COLUMN "purchase_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD COLUMN "product_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD COLUMN "gl_account_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD COLUMN "match_status" text DEFAULT 'unmatched' NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ADD COLUMN "vendor_id" uuid;--> statement-breakpoint
UPDATE "modbm_core"."purchase_invoices" pi SET "vendor_id" = po."vendor_id" FROM "modbm_core"."purchase_orders" po WHERE pi."purchase_order_id" = po."purchase_order_id";--> statement-breakpoint
UPDATE "modbm_core"."purchase_invoices" SET "vendor_id" = '899ad915-3dc0-4dee-8ad6-473c50a3ac86' WHERE "vendor_id" IS NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ALTER COLUMN "vendor_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoice_lines" ADD CONSTRAINT "purchase_invoice_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_invoices" ADD CONSTRAINT "purchase_invoices_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;