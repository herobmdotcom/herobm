CREATE TABLE "herobm_core"."bank_statement_lines" (
	"line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"date" date NOT NULL,
	"description" text NOT NULL,
	"amount" numeric NOT NULL,
	"reference" text,
	"is_reconciled" boolean DEFAULT false NOT NULL,
	"reconciliation_id" uuid,
	"matched_journal_line_id" uuid,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."csv_mapping_profiles" (
	"profile_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid,
	"name" text NOT NULL,
	"date_column" text NOT NULL,
	"amount_column" text NOT NULL,
	"description_column" text NOT NULL,
	"reference_column" text,
	"header_rows" integer DEFAULT 1 NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "herobm_core"."reconciliation_rules" (
	"rule_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gl_account_id" uuid,
	"condition_type" text NOT NULL,
	"condition_value" text NOT NULL,
	"target_gl_account_id" uuid NOT NULL,
	"priority" integer DEFAULT 10 NOT NULL,
	"created_on" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_reconciliation_id_gl_reconciliations_reconciliation_id_fk" FOREIGN KEY ("reconciliation_id") REFERENCES "herobm_core"."gl_reconciliations"("reconciliation_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."bank_statement_lines" ADD CONSTRAINT "bank_statement_lines_matched_journal_line_id_gl_journal_lines_journal_line_id_fk" FOREIGN KEY ("matched_journal_line_id") REFERENCES "herobm_core"."gl_journal_lines"("journal_line_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."csv_mapping_profiles" ADD CONSTRAINT "csv_mapping_profiles_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "herobm_core"."reconciliation_rules" ADD CONSTRAINT "reconciliation_rules_target_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("target_gl_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;