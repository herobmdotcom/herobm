CREATE TABLE "modbm_core"."locations" (
	"location_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"address_line_1" text,
	"city" text,
	"state" text,
	"country" text,
	"post_code" text,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "locations_code_unique" UNIQUE("code"),
	CONSTRAINT "locations_source_id_unique" UNIQUE("source_id")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."zones" (
	"zone_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"location_id" uuid NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"source_id" text,
	"source" text DEFAULT 'app' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "zones_source_id_unique" UNIQUE("source_id"),
	CONSTRAINT "zones_code_location_unq" UNIQUE("code","location_id")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" DROP CONSTRAINT "bins_bin_number_location_unq";--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" ADD COLUMN "zone_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD COLUMN "location_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD COLUMN "zone_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."zones" ADD CONSTRAINT "zones_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" ADD CONSTRAINT "bins_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "modbm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "modbm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" ADD CONSTRAINT "inventory_ledger_zone_id_zones_zone_id_fk" FOREIGN KEY ("zone_id") REFERENCES "modbm_core"."zones"("zone_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" DROP COLUMN "location_no";--> statement-breakpoint
ALTER TABLE "modbm_core"."inventory_ledger" DROP COLUMN "location_no";--> statement-breakpoint
ALTER TABLE "modbm_core"."bins" ADD CONSTRAINT "bins_bin_number_zone_unq" UNIQUE("bin_number","zone_id");