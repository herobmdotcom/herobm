ALTER TABLE "modbm_core"."customers" ADD COLUMN "parent_customer_id" uuid;
DO $$ BEGIN
 ALTER TABLE "modbm_core"."customers" ADD CONSTRAINT "customers_parent_customer_id_customers_customer_id_fk" FOREIGN KEY ("parent_customer_id") REFERENCES "modbm_core"."customers"("customer_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
