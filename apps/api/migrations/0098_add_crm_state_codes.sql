ALTER TABLE "herobm_core"."actors" ADD COLUMN "state_code" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."contacts" ADD COLUMN "state_code" text DEFAULT 'active' NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."projects" ADD COLUMN "state_code" text DEFAULT 'active' NOT NULL;