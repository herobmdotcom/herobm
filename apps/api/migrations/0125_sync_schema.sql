CREATE TABLE "herobm_core"."user_two_factor" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"secret_encrypted" text NOT NULL,
	"is_enabled" boolean NOT NULL,
	"backup_codes" jsonb NOT NULL,
	"verified_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."user_two_factor" ADD CONSTRAINT "user_two_factor_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "herobm_core"."users"("user_id") ON DELETE cascade ON UPDATE no action;