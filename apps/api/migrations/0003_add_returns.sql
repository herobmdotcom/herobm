-- Migration: Add returns tracking tables
-- Tables: sales_order_returns, sales_order_return_lines

CREATE TABLE IF NOT EXISTS modbm_core.sales_order_returns (
    return_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_number       TEXT UNIQUE NOT NULL,
    sales_order_id      UUID NOT NULL REFERENCES modbm_core.sales_orders(sales_order_id),
    state_code          TEXT NOT NULL DEFAULT 'draft',
    notes               TEXT,
    created_by          TEXT,
    created_on          TIMESTAMPTZ DEFAULT now(),
    modified_on         TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS modbm_core.sales_order_return_lines (
    return_line_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    return_id           UUID NOT NULL REFERENCES modbm_core.sales_order_returns(return_id),
    sales_order_line_id UUID NOT NULL REFERENCES modbm_core.sales_order_lines(sales_order_line_id),
    quantity_returned   NUMERIC NOT NULL,
    reason              TEXT,
    return_fee          NUMERIC DEFAULT 0
);
