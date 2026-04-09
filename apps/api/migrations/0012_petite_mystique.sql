CREATE TABLE "modbm_core"."purchase_order_return_lines" (
	"return_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"quantity_returned" numeric NOT NULL,
	"reason" text,
	"return_fee" numeric DEFAULT '0'
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."purchase_order_returns" (
	"return_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_number" text NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"notes" text,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "purchase_order_returns_return_number_unique" UNIQUE("return_number")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_return_id_purchase_order_returns_return_id_fk" FOREIGN KEY ("return_id") REFERENCES "modbm_core"."purchase_order_returns"("return_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_return_lines" ADD CONSTRAINT "purchase_order_return_lines_purchase_order_line_id_purchase_order_lines_purchase_order_line_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "modbm_core"."purchase_order_lines"("purchase_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."purchase_order_returns" ADD CONSTRAINT "purchase_order_returns_purchase_order_id_purchase_orders_purchase_order_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") ON DELETE no action ON UPDATE no action;