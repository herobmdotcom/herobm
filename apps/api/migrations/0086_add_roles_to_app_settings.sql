ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "actor_contact_roles" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "project_contact_roles" text[] DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "project_actor_roles" text[] DEFAULT ARRAY[]::text[];