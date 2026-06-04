ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "amount_min" numeric;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "amount_max" numeric;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "cost_center_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "activity_id" uuid;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "party_type" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD COLUMN "party_id" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "modbm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modbm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_activity_id_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "modbm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;