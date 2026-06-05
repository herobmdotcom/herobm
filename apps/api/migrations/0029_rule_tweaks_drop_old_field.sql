ALTER TABLE "modbm_core"."reconciliation_rules" DROP CONSTRAINT "reconciliation_rules_gl_account_id_gl_accounts_gl_account_id_fk";
--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" DROP COLUMN "gl_account_id";