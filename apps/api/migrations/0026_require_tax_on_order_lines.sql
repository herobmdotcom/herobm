-- Add NOT NULL constraints to order lines' tax_category_id

-- 1. Ensure any legacy/stray NULL values are backfilled first with the system default
DO $$
DECLARE
    default_tax_id uuid;
BEGIN
    SELECT tax_category_id INTO default_tax_id
    FROM modbm_core.tax_categories 
    WHERE code = 'GST' 
    LIMIT 1;

    -- Fallback to the first available category if 'GST' doesn't exist
    IF default_tax_id IS NULL THEN
        SELECT tax_category_id INTO default_tax_id
        FROM modbm_core.tax_categories 
        LIMIT 1;
    END IF;

    IF default_tax_id IS NOT NULL THEN
        UPDATE modbm_core.sales_order_lines
        SET tax_category_id = default_tax_id
        WHERE tax_category_id IS NULL;

        UPDATE modbm_core.purchase_order_lines
        SET tax_category_id = default_tax_id
        WHERE tax_category_id IS NULL;
    END IF;
END $$;

-- 2. Apply NOT NULL constraints
ALTER TABLE modbm_core.sales_order_lines ALTER COLUMN tax_category_id SET NOT NULL;
ALTER TABLE modbm_core.purchase_order_lines ALTER COLUMN tax_category_id SET NOT NULL;
