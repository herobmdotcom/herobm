-- Migration: 0047_payment_entries_and_fixes.sql
-- Description: Create payment entries and allocations tables for Accounts Receivable / Accounts Payable

CREATE TABLE IF NOT EXISTS "modbm_core"."payment_entries" (
	"payment_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_number" text NOT NULL,
	"payment_type" text NOT NULL,
	"party_type" text NOT NULL,
	"party_id" uuid NOT NULL,
	"payment_date" timestamp with time zone NOT NULL,
	"mode_of_payment" text NOT NULL,
	"total_amount" numeric NOT NULL,
	"unallocated_amount" numeric NOT NULL,
	"gl_account_bank" uuid NOT NULL,
	"reference_number" text,
	"state_code" text DEFAULT 'draft' NOT NULL,
	"currency_code" text NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"modified_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "payment_entries_payment_number_unique" UNIQUE("payment_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "modbm_core"."payment_allocations" (
	"allocation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"allocated_amount" numeric NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."payment_allocations" ADD CONSTRAINT "payment_allocations_payment_id_payment_entries_payment_id_fk" FOREIGN KEY ("payment_id") REFERENCES "modbm_core"."payment_entries"("payment_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."payment_entries" ADD CONSTRAINT "payment_entries_gl_account_bank_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_bank") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;