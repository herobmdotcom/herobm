CREATE TABLE IF NOT EXISTS "modbm_core"."report_contexts" (
	"report_id" uuid NOT NULL,
	"context" text NOT NULL,
	CONSTRAINT "report_contexts_report_id_context_pk" PRIMARY KEY("report_id","context")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modbm_core"."report_hook_assignments" (
	"hook_slug" text PRIMARY KEY NOT NULL,
	"report_id" uuid NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modbm_core"."reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"template" text NOT NULL,
	"mock_data" jsonb,
	"output_name_pattern" text DEFAULT 'Report.pdf',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "reports_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."report_contexts" ADD CONSTRAINT "report_contexts_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."report_hook_assignments" ADD CONSTRAINT "report_hook_assignments_report_id_reports_id_fk" FOREIGN KEY ("report_id") REFERENCES "modbm_core"."reports"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;