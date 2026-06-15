CREATE TABLE "herobm_core"."business_report_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."email_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."integration_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"entity_display_name" text,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
