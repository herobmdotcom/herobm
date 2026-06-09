CREATE TYPE "modbm_core"."email_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'dismissed');--> statement-breakpoint
ALTER TABLE "modbm_core"."email_outbox" ALTER COLUMN "status" SET DEFAULT 'pending'::"modbm_core"."email_status";--> statement-breakpoint
ALTER TABLE "modbm_core"."email_outbox" ALTER COLUMN "status" SET DATA TYPE "modbm_core"."email_status" USING "status"::"modbm_core"."email_status";--> statement-breakpoint
ALTER TABLE "modbm_core"."email_outbox" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."email_outbox" ADD COLUMN "entity_id" uuid;