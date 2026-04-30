CREATE TABLE IF NOT EXISTS "modbm_core"."gl_reconciliations" (
	"reconciliation_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"statement_date" date NOT NULL,
	"statement_balance" numeric NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	"posted_on" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD COLUMN "is_reconciled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "modbm_core"."gl_journal_lines" ADD COLUMN "reconciliation_id" uuid;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_reconciliations" ADD CONSTRAINT "gl_reconciliations_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_reconciliation_id_gl_reconciliations_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "modbm_core"."gl_reconciliations"("reconciliation_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
