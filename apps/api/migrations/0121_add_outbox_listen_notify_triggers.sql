-- Migration 0121: Add Postgres LISTEN/NOTIFY triggers for outbox and email_outbox
CREATE OR REPLACE FUNCTION herobm_core.notify_outbox_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('herobm_outbox_events', NEW.outbox_id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_outbox_notify ON herobm_core.outbox;--> statement-breakpoint
CREATE TRIGGER trg_outbox_notify
AFTER INSERT ON herobm_core.outbox
FOR EACH ROW EXECUTE FUNCTION herobm_core.notify_outbox_event();--> statement-breakpoint

CREATE OR REPLACE FUNCTION herobm_core.notify_email_outbox_event()
RETURNS trigger AS $$
BEGIN
  PERFORM pg_notify('herobm_email_outbox_events', NEW.id::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;--> statement-breakpoint

DROP TRIGGER IF EXISTS trg_email_outbox_notify ON herobm_core.email_outbox;--> statement-breakpoint
CREATE TRIGGER trg_email_outbox_notify
AFTER INSERT ON herobm_core.email_outbox
FOR EACH ROW EXECUTE FUNCTION herobm_core.notify_email_outbox_event();
