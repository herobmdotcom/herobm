ALTER TABLE "herobm_core"."actors" RENAME COLUMN "headquarters_address" TO "headquarters_address_line1";--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD COLUMN "headquarters_address_line2" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD COLUMN "headquarters_city" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD COLUMN "headquarters_state_or_province" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD COLUMN "headquarters_postal_code" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."actors" ADD COLUMN "headquarters_country" text;
