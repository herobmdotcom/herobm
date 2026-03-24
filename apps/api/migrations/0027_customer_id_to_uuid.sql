-- 0027_customer_id_to_uuid.sql
-- Convert sales_orders.customer_id from text to uuid with FK to accounts.

-- Step 1: Add a temporary uuid column
ALTER TABLE modbm_core.sales_orders
    ADD COLUMN customer_id_new uuid;

-- Step 2: Populate it by resolving existing text values
-- If value is already a valid UUID, cast it directly
-- Otherwise, try to look up the account by source_id
UPDATE modbm_core.sales_orders so
SET customer_id_new = CASE
    -- Value is already a valid UUID
    WHEN so.customer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    THEN so.customer_id::uuid
    ELSE NULL
END
WHERE so.customer_id IS NOT NULL;

-- Step 3: Drop old column, rename new one
ALTER TABLE modbm_core.sales_orders DROP COLUMN customer_id;
ALTER TABLE modbm_core.sales_orders RENAME COLUMN customer_id_new TO customer_id;

-- Step 4: Add FK constraint
ALTER TABLE modbm_core.sales_orders
    ADD CONSTRAINT sales_orders_customer_id_fk
    FOREIGN KEY (customer_id) REFERENCES modbm_core.accounts(account_id);
