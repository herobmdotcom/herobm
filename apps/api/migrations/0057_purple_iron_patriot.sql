CREATE TABLE "modbm_core"."payment_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"event_type" text NOT NULL,
	"payload" jsonb,
	"actor" text,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_events" ADD CONSTRAINT "payment_events_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "modbm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;