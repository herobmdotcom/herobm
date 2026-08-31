-- Migration 0135: Allow deletion of DRAFT payment records while protecting submitted/posted/cancelled payments

CREATE OR REPLACE FUNCTION herobm_core.guard_delete_draft_payment()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.state_code != 'draft' THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table % is prohibited when state is % (only draft records can be deleted). Use voiding, status cancellations, or credit notes.', TG_TABLE_NAME, OLD.state_code;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION herobm_core.guard_delete_payment_lines()
RETURNS TRIGGER AS $$
DECLARE
  v_state text;
BEGIN
  SELECT state_code INTO v_state FROM herobm_core.payment_entries WHERE payment_id = OLD.payment_id;
  IF v_state IS NOT NULL AND v_state != 'draft' THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table payment_lines is prohibited when payment is % (only draft records can be deleted).', v_state;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

CREATE OR REPLACE FUNCTION herobm_core.guard_delete_payment_allocations()
RETURNS TRIGGER AS $$
DECLARE
  v_state text;
BEGIN
  SELECT state_code INTO v_state FROM herobm_core.payment_entries WHERE payment_id = OLD.payment_id;
  IF v_state IS NOT NULL AND v_state != 'draft' THEN
    RAISE EXCEPTION 'COMPLIANCE VIOLATION: Hard deletion on table payment_allocations is prohibited when payment is % (only draft records can be deleted).', v_state;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_payment_entries ON herobm_core.payment_entries;--> statement-breakpoint
CREATE TRIGGER trg_protect_payment_entries
BEFORE DELETE ON herobm_core.payment_entries
FOR EACH ROW EXECUTE FUNCTION herobm_core.guard_delete_draft_payment();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_payment_lines ON herobm_core.payment_lines;--> statement-breakpoint
CREATE TRIGGER trg_protect_payment_lines
BEFORE DELETE ON herobm_core.payment_lines
FOR EACH ROW EXECUTE FUNCTION herobm_core.guard_delete_payment_lines();--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_protect_payment_allocations ON herobm_core.payment_allocations;--> statement-breakpoint
CREATE TRIGGER trg_protect_payment_allocations
BEFORE DELETE ON herobm_core.payment_allocations
FOR EACH ROW EXECUTE FUNCTION herobm_core.guard_delete_payment_allocations();--> statement-breakpoint

ALTER TABLE herobm_core.user_events
DROP CONSTRAINT IF EXISTS user_events_user_id_users_user_id_fk;

