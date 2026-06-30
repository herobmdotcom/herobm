-- Custom SQL migration file, put your code below! --
ALTER TABLE "herobm_core"."sales_order_returns" ADD COLUMN "location_id" uuid;
DO $$ BEGIN
 ALTER TABLE "herobm_core"."sales_order_returns" ADD CONSTRAINT "sales_order_returns_location_id_locations_location_id_fk" FOREIGN KEY ("location_id") REFERENCES "herobm_core"."locations"("location_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;