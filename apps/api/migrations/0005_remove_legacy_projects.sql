-- 1. Migrate any remaining data from legacy project tables to opportunities
INSERT INTO "herobm_core"."opportunities" (
	"opportunity_id", "state_code", "name", "status", "type", "owner_id", "created_on", "modified_on"
)
SELECT 
	"project_id", "state_code", "name", "status", "type", "owner_id", "created_on", "modified_on"
FROM "herobm_core"."projects"
ON CONFLICT ("opportunity_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "herobm_core"."opportunity_actors" (
	"opportunity_actor_id", "opportunity_id", "actor_id", "roles", "created_on"
)
SELECT 
	"project_actor_id", "project_id", "actor_id", "roles", "created_on"
FROM "herobm_core"."project_actors"
ON CONFLICT ("opportunity_actor_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "herobm_core"."opportunity_contacts" (
	"opportunity_contact_id", "opportunity_id", "contact_id", "roles", "created_on"
)
SELECT 
	"project_contact_id", "project_id", "contact_id", "roles", "created_on"
FROM "herobm_core"."project_contacts"
ON CONFLICT ("opportunity_contact_id") DO NOTHING;
--> statement-breakpoint
INSERT INTO "herobm_core"."opportunity_notes" (
	"note_id", "opportunity_id", "content", "created_by_id", "created_on"
)
SELECT 
	"note_id", "project_id", "content", "created_by_id", "created_on"
FROM "herobm_core"."project_notes"
ON CONFLICT ("note_id") DO NOTHING;
--> statement-breakpoint

-- 2. Rename column project_id to opportunity_id in crm_activities
ALTER TABLE "herobm_core"."crm_activities" 
	RENAME COLUMN "project_id" TO "opportunity_id";
--> statement-breakpoint
ALTER TABLE "herobm_core"."crm_activities" 
	RENAME CONSTRAINT "crm_activities_project_id_opportunities_opportunity_id_fk" 
	TO "crm_activities_opportunity_id_opportunities_opportunity_id_fk";
--> statement-breakpoint

-- 3. Drop legacy project tables
DROP TABLE IF EXISTS "herobm_core"."project_notes" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "herobm_core"."project_contacts" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "herobm_core"."project_actors" CASCADE;
--> statement-breakpoint
DROP TABLE IF EXISTS "herobm_core"."projects" CASCADE;
--> statement-breakpoint

-- 4. Rename app_settings columns from project_* to opportunity_*
ALTER TABLE "herobm_core"."app_settings" 
	RENAME COLUMN "project_statuses" TO "opportunity_stages";
--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" 
	RENAME COLUMN "project_types" TO "opportunity_types";
--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" 
	RENAME COLUMN "project_contact_roles" TO "opportunity_contact_roles";
--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" 
	RENAME COLUMN "project_actor_roles" TO "opportunity_actor_roles";
