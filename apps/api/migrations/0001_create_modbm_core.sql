-- Migration: Create modbm_core schema and tables
-- Generated from: apps/api/src/drizzle/modbm-core-schema.ts
-- Constitution §4: Schema as Code (Drizzle Gate)

CREATE SCHEMA IF NOT EXISTS modbm_core;

-- sales_orders (CDM: SalesOrder)
CREATE TABLE modbm_core.sales_orders (
    sales_order_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number        TEXT NOT NULL UNIQUE,
    name                TEXT,
    customer_id         TEXT,
    customer_order_number TEXT,
    state_code          TEXT NOT NULL DEFAULT 'draft',
    notes               TEXT,
    custom_fields       JSONB,
    created_by          TEXT,
    created_on          TIMESTAMPTZ DEFAULT NOW(),
    modified_on         TIMESTAMPTZ DEFAULT NOW()
);

-- sales_order_lines (CDM: SalesOrderProduct)
CREATE TABLE modbm_core.sales_order_lines (
    sales_order_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id      UUID NOT NULL REFERENCES modbm_core.sales_orders(sales_order_id),
    line_number         INTEGER NOT NULL,
    product_id          TEXT,
    product_description TEXT,
    quantity            NUMERIC NOT NULL,
    price_per_unit      NUMERIC NOT NULL,
    discount_percentage NUMERIC DEFAULT 0,
    amount              NUMERIC,
    tax                 NUMERIC DEFAULT 0,
    total_amount        NUMERIC,
    unit_of_measure     TEXT
);

-- order_events (Audit log + event sourcing)
CREATE TABLE modbm_core.order_events (
    event_id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sales_order_id      UUID NOT NULL REFERENCES modbm_core.sales_orders(sales_order_id),
    event_type          TEXT NOT NULL,
    payload             JSONB,
    actor               TEXT,
    created_on          TIMESTAMPTZ DEFAULT NOW()
);

-- outbox (Transactional outbox for async BullMQ/ERPNext sync)
CREATE TABLE modbm_core.outbox (
    outbox_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    aggregate_type      TEXT NOT NULL,
    aggregate_id        UUID NOT NULL,
    event_type          TEXT NOT NULL,
    payload             JSONB,
    created_on          TIMESTAMPTZ DEFAULT NOW(),
    processed_at        TIMESTAMPTZ
);

-- Indexes for common query patterns
CREATE INDEX idx_sales_orders_customer ON modbm_core.sales_orders(customer_id);
CREATE INDEX idx_sales_orders_state ON modbm_core.sales_orders(state_code);
CREATE INDEX idx_order_lines_order ON modbm_core.sales_order_lines(sales_order_id);
CREATE INDEX idx_order_events_order ON modbm_core.order_events(sales_order_id);
CREATE INDEX idx_outbox_unprocessed ON modbm_core.outbox(processed_at) WHERE processed_at IS NULL;
