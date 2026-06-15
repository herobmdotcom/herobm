CREATE TYPE "herobm_core"."email_status" AS ENUM('pending', 'sending', 'sent', 'failed', 'dismissed');--> statement-breakpoint
ALTER TABLE "herobm_core"."email_outbox" ALTER COLUMN "status" SET DEFAULT 'pending'::"herobm_core"."email_status";--> statement-breakpoint
ALTER TABLE "herobm_core"."email_outbox" ALTER COLUMN "status" SET DATA TYPE "herobm_core"."email_status" USING "status"::"herobm_core"."email_status";--> statement-breakpoint
ALTER TABLE "herobm_core"."email_outbox" ADD COLUMN "entity_type" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."email_outbox" ADD COLUMN "entity_id" uuid;