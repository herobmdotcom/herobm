ALTER TABLE "herobm_core"."project_ledger_entries" ADD COLUMN IF NOT EXISTS "is_billable" boolean DEFAULT true NOT NULL;
