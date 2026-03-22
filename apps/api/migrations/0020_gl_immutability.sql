-- Migration: GL Immutability and Manual Entries
-- Description: Adds party_type and party_id to journal lines, and creates immutability triggers

BEGIN;

-- 1. Add Subledger Party columns to Journal Lines
ALTER TABLE modbm_core.gl_journal_lines ADD COLUMN IF NOT EXISTS party_type text;
ALTER TABLE modbm_core.gl_journal_lines ADD COLUMN IF NOT EXISTS party_id text;


-- 2. Create the Trigger Function to block tampering
CREATE OR REPLACE FUNCTION modbm_core.prevent_gl_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        RAISE EXCEPTION 'GL tampering is strictly prohibited: DELETE operation rejected on %.', TG_TABLE_NAME;
    END IF;

    IF TG_OP = 'UPDATE' THEN
        -- Only allow updates to `is_reversed` and `reversed_by` on the header table
        IF TG_TABLE_NAME = 'gl_journal_entries' THEN
            IF NEW.journal_entry_id = OLD.journal_entry_id
               AND NEW.entry_number = OLD.entry_number
               AND NEW.entry_date = OLD.entry_date
               AND NEW.memo = OLD.memo
               AND NEW.source_type = OLD.source_type
               AND NEW.source_id = OLD.source_id
               AND NEW.created_by = OLD.created_by
               AND NEW.created_on = OLD.created_on THEN
                -- Everything else is exactly the same, so this is just a reversal update. Allow it.
                RETURN NEW;
            ELSE
                RAISE EXCEPTION 'GL tampering is strictly prohibited: UPDATE operation rejected on gl_journal_entries. Only reverse flags can be updated.';
            END IF;
        ELSE
            -- This is gl_journal_lines or something else. Block entirely.
            RAISE EXCEPTION 'GL tampering is strictly prohibited: UPDATE operation rejected on %.', TG_TABLE_NAME;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Attach trigger to gl_journal_lines
DROP TRIGGER IF EXISTS trg_gl_journal_lines_tampering ON modbm_core.gl_journal_lines;
CREATE TRIGGER trg_gl_journal_lines_tampering
BEFORE UPDATE OR DELETE ON modbm_core.gl_journal_lines
FOR EACH ROW EXECUTE FUNCTION modbm_core.prevent_gl_tampering();

-- 4. Attach trigger to gl_journal_entries
DROP TRIGGER IF EXISTS trg_gl_journal_entries_tampering ON modbm_core.gl_journal_entries;
CREATE TRIGGER trg_gl_journal_entries_tampering
BEFORE UPDATE OR DELETE ON modbm_core.gl_journal_entries
FOR EACH ROW EXECUTE FUNCTION modbm_core.prevent_gl_tampering();

COMMIT;
