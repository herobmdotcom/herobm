-- Migration 0133: Enforce Fiscal Period Hard-Lock at Database Level

CREATE OR REPLACE FUNCTION herobm_core.enforce_gl_journal_fiscal_period_lock()
RETURNS trigger AS $$
DECLARE
  v_period_name text;
  v_start_date date;
  v_end_date date;
BEGIN
  SELECT period_name, start_date, end_date
    INTO v_period_name, v_start_date, v_end_date
    FROM herobm_core.gl_fiscal_periods
   WHERE NEW.entry_date >= start_date
     AND NEW.entry_date <= end_date
     AND status = 'hard_closed'
   LIMIT 1;

  IF v_period_name IS NOT NULL THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Cannot post journal entry into hard-closed accounting period % (% to %). Postings in closed periods are forbidden by statutory accounting policy.',
      v_period_name, v_start_date, v_end_date;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_enforce_fiscal_period_lock_insert ON herobm_core.gl_journal_entries;--> statement-breakpoint
CREATE TRIGGER trg_enforce_fiscal_period_lock_insert
BEFORE INSERT ON herobm_core.gl_journal_entries
FOR EACH ROW EXECUTE FUNCTION herobm_core.enforce_gl_journal_fiscal_period_lock();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_enforce_fiscal_period_lock_update ON herobm_core.gl_journal_entries;--> statement-breakpoint
CREATE TRIGGER trg_enforce_fiscal_period_lock_update
BEFORE UPDATE OF entry_date ON herobm_core.gl_journal_entries
FOR EACH ROW EXECUTE FUNCTION herobm_core.enforce_gl_journal_fiscal_period_lock();
