CREATE TABLE IF NOT EXISTS "herobm_core"."project_resource_assignments" (
	"assignment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"resource_id" uuid NOT NULL,
	"notes" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"created_by" text
);
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_resource_assignments_project_id_projects_project_id_fk'
  ) THEN
    ALTER TABLE "herobm_core"."project_resource_assignments" ADD CONSTRAINT "project_resource_assignments_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE cascade ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'project_resource_assignments_resource_id_project_resources_resource_id_fk'
  ) THEN
    ALTER TABLE "herobm_core"."project_resource_assignments" ADD CONSTRAINT "project_resource_assignments_resource_id_project_resources_resource_id_fk" FOREIGN KEY ("resource_id") REFERENCES "herobm_core"."project_resources"("resource_id") ON DELETE restrict ON UPDATE no action;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_resource_assignments_project_id" ON "herobm_core"."project_resource_assignments" USING btree ("project_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_project_resource_assignments_resource_id" ON "herobm_core"."project_resource_assignments" USING btree ("resource_id");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unq_project_resource_assignments_project_resource" ON "herobm_core"."project_resource_assignments" USING btree ("project_id","resource_id");