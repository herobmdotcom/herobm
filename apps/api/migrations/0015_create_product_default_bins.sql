CREATE TABLE "modbm_core"."product_default_bins" (
	"product_default_bin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"location_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"is_primary" boolean DEFAULT true NOT NULL,
	"min_quantity" numeric DEFAULT '0',
	"max_quantity" numeric,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "product_default_bins_prod_loc_bin_unq" UNIQUE("product_id","location_id","bin_id")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN "alternate_invoice_description" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN "box_quantity" numeric DEFAULT '1';--> statement-breakpoint
ALTER TABLE "modbm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."product_default_bins" ADD CONSTRAINT "product_default_bins_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;