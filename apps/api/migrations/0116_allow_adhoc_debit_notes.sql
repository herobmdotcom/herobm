ALTER TABLE "herobm_core"."purchase_debit_note_lines" ALTER COLUMN "purchase_order_line_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ALTER COLUMN "return_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_notes" ALTER COLUMN "purchase_order_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD COLUMN "description" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD COLUMN "account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD COLUMN "tax_category_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_tax_category_id_tax_categories_tax_category_id_fk" FOREIGN KEY ("tax_category_id") REFERENCES "herobm_core"."tax_categories"("tax_category_id") ON DELETE no action ON UPDATE no action;