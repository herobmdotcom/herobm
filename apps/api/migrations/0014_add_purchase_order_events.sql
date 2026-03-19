-- Migration: Add purchase_order_events table for audit and Activity Timeline
-- 0014_add_purchase_order_events.sql

CREATE TABLE IF NOT EXISTS "modbm_core"."purchase_order_events" (
    "event_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "purchase_order_id" UUID NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB,
    "actor" TEXT,
    "created_on" TIMESTAMPTZ DEFAULT now()
);

DO $$ BEGIN
    ALTER TABLE "modbm_core"."purchase_order_events" 
    ADD CONSTRAINT "purchase_order_events_purchase_order_id_purchase_orders_purchase_order_id_fk" 
    FOREIGN KEY ("purchase_order_id") REFERENCES "modbm_core"."purchase_orders"("purchase_order_id") 
    ON DELETE no action ON UPDATE no action;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
