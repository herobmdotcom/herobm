CREATE TABLE "herobm_core"."email_outbox" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"to_address" text NOT NULL,
	"reply_to" text,
	"subject" text NOT NULL,
	"html_body" text NOT NULL,
	"attachments" jsonb DEFAULT '[]'::jsonb,
	"status" text DEFAULT 'pending' NOT NULL,
	"retries" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"next_retry_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "smtp_host" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "smtp_port" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "smtp_user" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "smtp_pass_encrypted" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."app_settings" ADD COLUMN "smtp_from_address" text;