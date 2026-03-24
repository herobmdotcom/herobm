-- Migration: Add SYSTEM-CUSTOM-LINE product
-- Required to support custom order lines in the frontend without breaking DB constraints

INSERT INTO modbm_core.products (
    product_id, 
    product_number, 
    name, 
    state_code, 
    notes,
    created_by
) VALUES (
    '00000000-0000-0000-0000-000000000000'::uuid, 
    'SYSTEM-CUSTOM-LINE', 
    'Custom Line Item', 
    'active', 
    'System product used for custom/blank lines on orders or invoices. DO NOT DELETE OR MODIFY.',
    'system'
) ON CONFLICT (product_number) DO NOTHING;
