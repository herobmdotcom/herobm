ALTER TABLE "herobm_core"."actors" ADD COLUMN "tags" text[] DEFAULT '{}';--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "actor_tags" jsonb DEFAULT '[]'::jsonb;