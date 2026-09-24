ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_otc_cash_account_id" uuid;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_settings" ADD COLUMN IF NOT EXISTS "default_otc_card_account_id" uuid;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gl_settings_default_otc_cash_account_id_gl_accounts_gl_account_id_fk'
  ) THEN
    ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_otc_cash_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_otc_cash_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'gl_settings_default_otc_card_account_id_gl_accounts_gl_account_id_fk'
  ) THEN
    ALTER TABLE "herobm_core"."gl_settings" ADD CONSTRAINT "gl_settings_default_otc_card_account_id_gl_accounts_gl_account_id_fk" FOREIGN KEY ("default_otc_card_account_id") REFERENCES "herobm_core"."gl_accounts"("gl_account_id") ON DELETE no action ON UPDATE no action;
  END IF;
END $$;
