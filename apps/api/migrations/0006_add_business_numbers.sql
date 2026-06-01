ALTER TABLE "modbm_core"."customers" ADD COLUMN "business_number" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD COLUMN "is_tax_registered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "business_number" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "is_tax_registered" boolean DEFAULT false NOT NULL;