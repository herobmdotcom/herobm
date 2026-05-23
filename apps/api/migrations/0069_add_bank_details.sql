ALTER TABLE "modbm_core"."customers" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD COLUMN "bank_bsb" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."customers" ADD COLUMN "bank_account_number" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."payment_entries" ADD COLUMN "aba_exported_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "bank_account_name" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "bank_bsb" text;--> statement-breakpoint
ALTER TABLE "modbm_core"."suppliers" ADD COLUMN "bank_account_number" text;