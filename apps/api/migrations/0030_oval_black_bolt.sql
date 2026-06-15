ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "system_identifier" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "active_license_key" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "active_license_payload" jsonb;