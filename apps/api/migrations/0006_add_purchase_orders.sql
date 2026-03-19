CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_order_lines" (
	"purchase_order_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"line_number" integer NOT NULL,
	"product_id" text,
	"product_description" text,
	"quantity" numeric NOT NULL,
	"price_per_unit" numeric NOT NULL,
	"discount_percentage" numeric DEFAULT '0',
	"amount" numeric,
	"tax" numeric DEFAULT '0',
	"total_amount" numeric,
	"unit_of_measure" text,
	"quantity_received" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_order_reception_lines" (
	"reception_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reception_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_received" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_order_receptions" (
	"reception_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"reception_number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"packing_slip_number" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_receptions_reception_number_unique" UNIQUE("reception_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_orders" (
	"purchase_order_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_number" text NOT NULL,
	"name" text,
	"vendor_id" text,
	"invoice_number" text,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"currency_code" text DEFAULT 'EUR' NOT NULL,
	"notes" text,
	"custom_fields" jsonb,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_order_reception_lines" ADD CONSTRAINT "purchase_order_reception_lines_reception_id_purchase_order_receptions_reception_id_fk" FOREIGN KEY ("reception_id") REFERENCES "modbm_core"."purchase_order_receptions"("reception_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_order_reception_lines" ADD CONSTRAINT "purchase_order_reception_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_order_receptions" ADD CONSTRAINT "purchase_order_receptions_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


