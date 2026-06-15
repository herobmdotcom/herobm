ALTER TABLE "herobm_core"."trading_terms" ADD COLUMN "source_id" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."trading_terms" ADD COLUMN "source" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."trading_terms" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "herobm_core"."trading_terms" ADD COLUMN "modified_on" timestamp with time zone DEFAULT now();