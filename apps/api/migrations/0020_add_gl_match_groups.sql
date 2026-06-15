CREATE TABLE "herobm_core"."gl_match_groups" (
	"match_group_id" uuid PRIMARY KEY NOT NULL,
	"match_type" text NOT NULL,
	"rule_id" uuid,
	"created_by" text NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."purchase_orders" ADD COLUMN "expected_date" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_match_groups" ADD CONSTRAINT "gl_match_groups_rule_id_reconciliation_rules_rule_id_fk" FOREIGN KEY ("rule_id") REFERENCES "herobm_core"."reconciliation_rules"("rule_id") ON DELETE no action ON UPDATE no action;