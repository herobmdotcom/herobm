ALTER TABLE "herobm_core"."sales_credit_note_lines" ALTER COLUMN "sales_order_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ALTER COLUMN "return_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ALTER COLUMN "sales_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD COLUMN "tax_category_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD COLUMN "customer_id" uuid;--> statement-breakpoint
UPDATE "herobm_core"."sales_credit_notes" scn SET customer_id = so.customer_id FROM "herobm_core"."sales_orders" so WHERE scn.sales_order_id = so.sales_order_id;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ALTER COLUMN "customer_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_customer_id_customers_customer_id_fk" FOREIGN KEY ("customer_id") REFERENCES "herobm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;