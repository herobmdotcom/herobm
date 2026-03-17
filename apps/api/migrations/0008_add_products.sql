-- Migration: Add products and product_events to modbm_core
-- Generated from: apps/api/src/drizzle/modbm-core-schema.ts

-- products (CDM: Product)
CREATE TABLE modbm_core.products (
    product_id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_number      TEXT NOT NULL UNIQUE,
    name                TEXT NOT NULL,
    barcode             TEXT,
    list_price          NUMERIC DEFAULT 0,
    standard_cost       NUMERIC DEFAULT 0,
    state_code          TEXT NOT NULL DEFAULT 'active',
    notes               TEXT,
    created_by          TEXT,
    created_on          TIMESTAMPTZ DEFAULT NOW(),
    modified_on         TIMESTAMPTZ DEFAULT NOW()
);

-- product_events (Audit log + event sourcing)
CREATE TABLE modbm_core.product_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id          UUID NOT NULL REFERENCES modbm_core.products(product_id),
    event_type          TEXT NOT NULL,
    payload             JSONB,
    actor               TEXT,
    created_on          TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_products_number ON modbm_core.products(product_number);
CREATE INDEX idx_products_name ON modbm_core.products(name);
CREATE INDEX idx_product_events_product ON modbm_core.product_events(product_id);
