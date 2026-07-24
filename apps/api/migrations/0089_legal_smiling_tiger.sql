CREATE OR REPLACE FUNCTION herobm_core.temp_convert_text_array_to_jsonb(arr text[]) RETURNS jsonb AS $$
DECLARE
  res jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(jsonb_build_object('value', el, 'order', idx)), '[]'::jsonb)
  INTO res
  FROM unnest(arr) WITH ORDINALITY AS t(el, idx);
  RETURN res;
END;
$$ LANGUAGE plpgsql IMMUTABLE;--> statement-breakpoint

ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "actor_contact_roles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_contact_roles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_actor_roles" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_statuses" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_types" DROP DEFAULT;--> statement-breakpoint

ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "actor_contact_roles" SET DATA TYPE jsonb USING herobm_core.temp_convert_text_array_to_jsonb(actor_contact_roles);--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "actor_contact_roles" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_contact_roles" SET DATA TYPE jsonb USING herobm_core.temp_convert_text_array_to_jsonb(project_contact_roles);--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_contact_roles" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_actor_roles" SET DATA TYPE jsonb USING herobm_core.temp_convert_text_array_to_jsonb(project_actor_roles);--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_actor_roles" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_statuses" SET DATA TYPE jsonb USING herobm_core.temp_convert_text_array_to_jsonb(project_statuses);--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_statuses" SET DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_types" SET DATA TYPE jsonb USING herobm_core.temp_convert_text_array_to_jsonb(project_types);--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ALTER COLUMN "project_types" SET DEFAULT '[]'::jsonb;--> statement-breakpoint

DROP FUNCTION herobm_core.temp_convert_text_array_to_jsonb(text[]);