ALTER TABLE "modbm_core"."app_settings" ADD COLUMN "tax_provider_mappings" jsonb;--> statement-breakpoint
ALTER TABLE "modbm_core"."products" ADD COLUMN "external_tax_code" text;