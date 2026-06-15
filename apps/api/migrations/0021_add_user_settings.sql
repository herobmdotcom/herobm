CREATE TABLE "herobm_core"."user_settings" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"dashboard_config" jsonb DEFAULT '{}'::jsonb,
	"report_configs" jsonb DEFAULT '{}'::jsonb,
	"preferences" jsonb DEFAULT '{}'::jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."user_settings" ADD CONSTRAINT "user_settings_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE cascade ON UPDATE no action;