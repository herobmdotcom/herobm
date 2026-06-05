ALTER TABLE "modbm_core"."reconciliation_rules" ALTER COLUMN "condition_type" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ALTER COLUMN "condition_value" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "gl_account_ids" jsonb;