ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "type_condition" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "payee_condition_type" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "payee_condition_value" text;