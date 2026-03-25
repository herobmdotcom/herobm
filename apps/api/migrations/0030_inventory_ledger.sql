CREATE TABLE IF NOT EXISTS "modbm_core"."bins" (
	"bin_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bin_number" text NOT NULL,
	"location_no" text DEFAULT 'MAIN' NOT NULL,
	"bin_type" text,
	"is_consignment" boolean DEFAULT false,
	"is_bonded" boolean DEFAULT false,
	"is_unavailable" boolean DEFAULT false,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bins_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "bins_bin_number_location_unq" UNIQUE("bin_number","location_no")
);

CREATE TABLE IF NOT EXISTS "modbm_core"."inventory_entries" (
	"entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" timestamp with time zone DEFAULT now() NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_by" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "inventory_entries_entry_number_unique" UNIQUE("entry_number")
);

CREATE TABLE IF NOT EXISTS "modbm_core"."inventory_ledger" (
	"ledger_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"bin_id" uuid NOT NULL,
	"location_no" text NOT NULL,
	"quantity" numeric NOT NULL
);

CREATE TABLE IF NOT EXISTS "modbm_core"."bin_contents" (
	"bin_content_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bin_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"actual_quantity" numeric DEFAULT '0' NOT NULL,
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "bin_contents_bin_product_unq" UNIQUE("bin_id","product_id")
);

DO $$ BEGIN
 ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_entry_id_inventory_entries_entry_id_fk" FOREIGN KEY ("entry_id") REFERENCES "modbm_core"."inventory_entries"("entry_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "modbm_core"."bin_contents" ADD CONSTRAINT "bin_contents_bin_id_bins_bin_id_fk" FOREIGN KEY ("bin_id") REFERENCES "modbm_core"."bins"("bin_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
 ALTER TABLE "modbm_core"."bin_contents" ADD CONSTRAINT "bin_contents_product_id_products_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "modbm_core"."products"("product_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
