CREATE TABLE "modbm_core"."cost_centers" (
	"cost_center_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "modbm_core"."activities" (
	"activity_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "activities_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD COLUMN "cost_center_id" uuid;
--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD COLUMN "activity_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_cost_center_id_cost_centers_cost_center_id_fk" FOREIGN KEY ("cost_center_id") REFERENCES "modbm_core"."cost_centers"("cost_center_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_activity_id_activities_activity_id_fk" FOREIGN KEY ("activity_id") REFERENCES "modbm_core"."activities"("activity_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
INSERT INTO "modbm_core"."cost_centers" ("code", "name", "is_system") VALUES ('00', 'Default Cost Center', true);
--> statement-breakpoint
INSERT INTO "modbm_core"."activities" ("code", "name", "is_system") VALUES ('00', 'Default Activity', true);
