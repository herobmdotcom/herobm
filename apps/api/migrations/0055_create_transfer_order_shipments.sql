CREATE TABLE "modbm_core"."transfer_order_picks" (
	"pick_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid,
	"quantity" numeric NOT NULL,
	"state_code" text DEFAULT 'picked' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_receipt_lines" (
	"receipt_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receipt_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_receipts" (
	"receipt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"receipt_number" text NOT NULL,
	"state_code" text DEFAULT 'received' NOT NULL,
	"received_by" text,
	"received_on" timestamp with time zone DEFAULT now(),
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_order_receipts_receipt_number_unique" UNIQUE("receipt_number")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_shipment_lines" (
	"shipment_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"shipment_id" uuid NOT NULL,
	"transfer_order_line_id" uuid NOT NULL,
	"pick_id" uuid,
	"product_id" uuid NOT NULL,
	"quantity" numeric NOT NULL
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."transfer_order_shipments" (
	"shipment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"transfer_order_id" uuid NOT NULL,
	"shipment_number" text NOT NULL,
	"tracking_number" text,
	"carrier_id" uuid,
	"state_code" text DEFAULT 'shipped' NOT NULL,
	"shipped_by" text,
	"shipped_on" timestamp with time zone DEFAULT now(),
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "transfer_order_shipments_shipment_number_unique" UNIQUE("shipment_number")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_picks" ADD CONSTRAINT "transfer_order_picks_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_receipt_id_transfer_order_receipts_receipt_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "modbm_core"."transfer_order_receipts"("receipt_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipt_lines" ADD CONSTRAINT "transfer_order_receipt_lines_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_receipts" ADD CONSTRAINT "transfer_order_receipts_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_shipment_id_transfer_order_shipments_shipment_id_fk" FOREIGN KEY ("shipment_id") REFERENCES "modbm_core"."transfer_order_shipments"("shipment_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_transfer_order_line_id_transfer_order_lines_transfer_order_line_id_fk" FOREIGN KEY ("transfer_order_line_id") REFERENCES "modbm_core"."transfer_order_lines"("transfer_order_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_pick_id_transfer_order_picks_pick_id_fk" FOREIGN KEY ("pick_id") REFERENCES "modbm_core"."transfer_order_picks"("pick_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipment_lines" ADD CONSTRAINT "transfer_order_shipment_lines_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."transfer_order_shipments" ADD CONSTRAINT "transfer_order_shipments_transfer_order_id_transfer_orders_transfer_order_id_fk" FOREIGN KEY ("transfer_order_id") REFERENCES "modbm_core"."transfer_orders"("transfer_order_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_transfer_order_picks_order" ON "modbm_core"."transfer_order_picks" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_picks_line" ON "modbm_core"."transfer_order_picks" USING btree ("transfer_order_line_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_receipt_lines_receipt" ON "modbm_core"."transfer_order_receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_receipts_order" ON "modbm_core"."transfer_order_receipts" USING btree ("transfer_order_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_shipment_lines_shipment" ON "modbm_core"."transfer_order_shipment_lines" USING btree ("shipment_id");--> statement-breakpoint
CREATE INDEX "idx_transfer_order_shipments_order" ON "modbm_core"."transfer_order_shipments" USING btree ("transfer_order_id");