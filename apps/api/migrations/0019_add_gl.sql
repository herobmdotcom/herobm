-- 0019_add_gl.sql
-- Native General Ledger: accounts, journal entries, journal lines, settings
-- Idempotent per conventions.md §12

CREATE TABLE IF NOT EXISTS "modbm_core"."gl_accounts" (
	"gl_account_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"account_code" text NOT NULL,
	"name" text NOT NULL,
	"account_type" text NOT NULL,
	"parent_account_id" uuid,
	"is_group" boolean DEFAULT false NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"currency_code" text DEFAULT 'AUD' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_accounts_account_code_unique" UNIQUE("account_code")
);

CREATE TABLE IF NOT EXISTS "modbm_core"."gl_journal_entries" (
	"journal_entry_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entry_number" text NOT NULL,
	"entry_date" date NOT NULL,
	"memo" text,
	"source_type" text NOT NULL,
	"source_id" uuid,
	"is_reversed" boolean DEFAULT false NOT NULL,
	"reversed_by" uuid,
	"created_by" text,
	"created_on" timestamp with time zone DEFAULT now(),
	CONSTRAINT "gl_journal_entries_entry_number_unique" UNIQUE("entry_number")
);

CREATE TABLE IF NOT EXISTS "modbm_core"."gl_journal_lines" (
	"journal_line_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"journal_entry_id" uuid NOT NULL,
	"gl_account_id" uuid NOT NULL,
	"debit" numeric DEFAULT '0' NOT NULL,
	"credit" numeric DEFAULT '0' NOT NULL,
	"memo" text
);

CREATE TABLE IF NOT EXISTS "modbm_core"."gl_settings" (
	"settings_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fiscal_year_start_month" integer DEFAULT 7 NOT NULL,
	"default_ar_account_id" uuid,
	"default_ap_account_id" uuid,
	"default_revenue_account_id" uuid,
	"default_cogs_account_id" uuid,
	"default_tax_account_id" uuid,
	"default_expense_account_id" uuid,
	"base_currency" text DEFAULT 'AUD' NOT NULL
);

-- Foreign keys (wrapped for idempotency per §12)

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_journal_entry_id_gl_journal_entries_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "modbm_core"."gl_journal_entries"("journal_entry_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_journal_lines" ADD CONSTRAINT "gl_journal_lines_gl_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("gl_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ar_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ar_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_ap_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_ap_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_revenue_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_revenue_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_cogs_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_cogs_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_tax_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_tax_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    ALTER TABLE "modbm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_expense_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_expense_account_id") REFERENCES "modbm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
