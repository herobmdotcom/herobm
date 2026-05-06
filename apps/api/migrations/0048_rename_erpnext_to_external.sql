DO $$ BEGIN
 ALTER TABLE "modbm_core"."accounts" RENAME COLUMN "erpnext_id" TO "external_id";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."suppliers" RENAME COLUMN "erpnext_id" TO "external_id";
EXCEPTION
 WHEN undefined_column THEN null;
END $$;