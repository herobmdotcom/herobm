ALTER TABLE "modbm_core"."outbox" ADD COLUMN "locked_until" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modbm_core"."outbox" ADD COLUMN "last_error" text;