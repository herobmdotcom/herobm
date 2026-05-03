-- Create user_events audit table for user management actions
CREATE TABLE "modbm_core"."user_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL REFERENCES "modbm_core"."users"("user_id") ON DELETE CASCADE,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);