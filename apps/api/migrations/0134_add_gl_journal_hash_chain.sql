-- Migration 0134: Add Cryptographic Hash Chaining to General Ledger Journal Entries

ALTER TABLE herobm_core.gl_journal_entries
  ADD COLUMN IF NOT EXISTS sequence_number INTEGER,
  ADD COLUMN IF NOT EXISTS prev_hash TEXT,
  ADD COLUMN IF NOT EXISTS entry_hash TEXT;--> statement-breakpoint

CREATE UNIQUE INDEX IF NOT EXISTS idx_gl_journal_entries_sequence_number
  ON herobm_core.gl_journal_entries (sequence_number);
