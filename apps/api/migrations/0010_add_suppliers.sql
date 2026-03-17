-- Create suppliers table in modbm_core
CREATE TABLE IF NOT EXISTS modbm_core.suppliers (
    vendor_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_number TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    address1_line1 TEXT,
    address1_line2 TEXT,
    address1_city TEXT,
    address1_state_or_province TEXT,
    address1_postal_code TEXT,
    address1_country TEXT,
    telephone1 TEXT,
    fax TEXT,
    email_address1 TEXT,
    payment_terms TEXT,
    currency_code TEXT NOT NULL DEFAULT 'EUR',
    state_code TEXT NOT NULL DEFAULT 'active',
    notes TEXT,
    created_by TEXT,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT now(),
    modified_on TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create supplier_events table for audit logging
CREATE TABLE IF NOT EXISTS modbm_core.supplier_events (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    vendor_id UUID NOT NULL REFERENCES modbm_core.suppliers(vendor_id),
    event_type TEXT NOT NULL,
    payload JSONB,
    actor TEXT,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT now()
);
