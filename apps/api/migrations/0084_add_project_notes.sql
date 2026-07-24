ALTER TABLE "herobm_core"."projects" ADD COLUMN "owner_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."projects" ADD CONSTRAINT "projects_owner_id_users_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "herobm_core"."project_notes" (
	"note_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_by_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."project_notes" ADD CONSTRAINT "project_notes_project_id_projects_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "herobm_core"."projects"("project_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "herobm_core"."project_notes" ADD CONSTRAINT "project_notes_created_by_id_users_user_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;