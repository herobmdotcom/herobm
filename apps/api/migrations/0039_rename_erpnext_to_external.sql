ALTER TABLE "modbm_core"."accounts" RENAME COLUMN "erpnext_id" TO "external_id";
--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" RENAME COLUMN "erpnext_id" TO "external_id";