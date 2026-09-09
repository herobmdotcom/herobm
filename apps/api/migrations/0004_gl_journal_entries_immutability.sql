ALTER TABLE "herobm_core"."gl_journal_entries" ADD COLUMN IF NOT EXISTS "sequence_number" integer;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_entries" ADD COLUMN IF NOT EXISTS "prev_hash" text;--> statement-breakpoint
ALTER TABLE "herobm_core"."gl_journal_entries" ADD COLUMN IF NOT EXISTS "entry_hash" text;--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "idx_gl_journal_entries_sequence_number" ON "herobm_core"."gl_journal_entries" USING btree ("sequence_number");
