CREATE TABLE "modbm_core"."purchase_debit_note_lines" (
	"debit_note_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_invoiced" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"amount" numeric NOT NULL,
	"tax_amount" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_debit_notes" (
	"debit_note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"debit_note_number" text NOT NULL,
	"supplier_reference_number" text,
	"return_id" uuid NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"vendor_id" uuid NOT NULL,
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
	CONSTRAINT "purchase_debit_notes_debit_note_number_unique" UNIQUE("debit_note_number"),
	CONSTRAINT "purchase_debit_notes_currency_check" CHECK (currency_code IN ('EUR', 'USD', 'CAD', 'GBP', 'DKK', 'SEK', 'MYR', 'AUD', 'IDR', 'NZD', 'SGD', 'JPY', 'KRW', 'LKR', 'ZAR', 'SAR')),
	CONSTRAINT "purchase_debit_note_state_check" CHECK (state_code IN ('draft', 'posted', 'cancelled'))
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_return_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"return_line_id" uuid NOT NULL,
	"quantity_shipped" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_return_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_number" text NOT NULL,
	"return_id" uuid NOT NULL,
	"state_code" text DEFAULT 'dispatched' NOT NULL,
	"notes" text,
	"tracking_number" text,
	"fulfillment_location_id" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_return_shipments_shipment_number_unique" UNIQUE("shipment_number"),
	CONSTRAINT "po_return_shipment_state_check" CHECK (state_code IN ('draft', 'dispatched', 'cancelled'))
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_debit_note_id_purchase_debit_notes_debit_note_id_fk" FOREIGN KEY ("debit_note_id") REFERENCES "modbm_core"."purchase_debit_notes"("debit_note_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_note_lines" ADD CONSTRAINT "purchase_debit_note_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_debit_notes" ADD CONSTRAINT "purchase_debit_notes_vendor_id_suppliers_vendor_id_fk" FOREIGN KEY ("vendor_id") REFERENCES "modbm_core"."suppliers"("vendor_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipment_lines" ADD CONSTRAINT "purchase_order_return_shipment_lines_shipment_id_purchase_order_return_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."purchase_order_return_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipment_lines" ADD CONSTRAINT "purchase_order_return_shipment_lines_return_line_id_purchase_order_return_lines_return_line_id_fk" FOREIGN KEY ("return_line_id") REFERENCES "modbm_core"."purchase_order_return_lines"("return_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipments" ADD CONSTRAINT "purchase_order_return_shipments_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_shipments" ADD CONSTRAINT "purchase_order_return_shipments_fulfillment_location_id_locations_location_id_fk" FOREIGN KEY ("fulfillment_location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_returns" ADD CONSTRAINT "po_return_state_check" CHECK (state_code IN ('draft', 'staged', 'shipped', 'cancelled'));