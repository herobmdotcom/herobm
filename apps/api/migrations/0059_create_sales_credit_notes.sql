CREATE TABLE "modbm_core"."sales_credit_note_lines" (
	"credit_note_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_id" uuid NOT NULL,
	"sales_order_line_id" uuid NOT NULL,
	"quantity_credited" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."sales_credit_notes" (
	"credit_note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"credit_note_number" text NOT NULL,
	"return_id" uuid NOT NULL,
	"sales_order_id" uuid NOT NULL,
	"invoice_id" uuid,
	"total_amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0',
	"fee_amount" numeric DEFAULT '0',
	"outstanding_amount" numeric DEFAULT '0' NOT NULL,
	"currency_code" text NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "sales_credit_notes_credit_note_number_unique" UNIQUE("credit_note_number"),
	CONSTRAINT "sales_credit_notes_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR'))
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_returns" DROP CONSTRAINT "sales_order_return_state_check";--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_shipments" ALTER COLUMN "state_code" SET DEFAULT 'dispatched';--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipments" ALTER COLUMN "state_code" SET DEFAULT 'dispatched';--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_orders" ALTER COLUMN "state_code" SET DEFAULT 'confirmed';--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD COLUMN "default_fee_revenue_account_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_credit_note_id_sales_credit_notes_credit_note_id_fk" FOREIGN KEY ("credit_note_id") REFERENCES "modbm_core"."sales_credit_notes"("credit_note_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_note_lines" ADD CONSTRAINT "sales_credit_note_lines_sales_order_line_id_sales_order_lines_sales_order_line_id_fk" FOREIGN KEY ("sales_order_line_id") REFERENCES "modbm_core"."sales_order_lines"("sales_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_return_id_sales_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."sales_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_sales_order_id_sales_orders_sales_order_id_fk" FOREIGN KEY ("sales_order_id") REFERENCES "modbm_core"."sales_orders"("sales_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_credit_notes" ADD CONSTRAINT "sales_credit_notes_invoice_id_sales_invoices_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "modbm_core"."sales_invoices"("invoice_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_fee_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_fee_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."sales_order_returns" ADD CONSTRAINT "return_state_check" CHECK (state_code IN ('draft', 'confirmed', 'received', 'processed', 'cancelled'));