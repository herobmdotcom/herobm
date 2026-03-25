-- 0031_ledger_views.sql

-- 1. Drop the legacy inventory_levels table (make sure to cascade to clear any rogue dependencies, though there are none)
DROP TABLE IF EXISTS modbm_core.inventory_levels CASCADE;

-- 2. Create the dynamic view to replace it
CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
SELECT 
    p.product_id,
    'MAIN'::text as location_no,
    gen_random_uuid() as inventory_level_id,
    COALESCE(SUM(bc.actual_quantity), 0) AS quantity_on_hand,
    COALESCE((
        SELECT SUM(sl.quantity - COALESCE(
            (SELECT SUM(ssl.quantity_shipped) 
             FROM modbm_core.sales_order_shipment_lines ssl 
             JOIN modbm_core.sales_order_shipments sh ON sh.shipment_id = ssl.shipment_id 
             WHERE ssl.sales_order_line_id = sl.sales_order_line_id 
               AND sh.state_code IN ('dispatched', 'delivered')
            ), 0)
        )
        FROM modbm_core.sales_order_lines sl
        JOIN modbm_core.sales_orders so ON so.sales_order_id = sl.sales_order_id
        WHERE sl.product_id = p.product_id
          AND so.state_code NOT IN ('draft', 'cancelled')
    ), 0) AS quantity_committed,
    COALESCE((
        SELECT SUM(pl.quantity - COALESCE(pl.quantity_received, 0))
        FROM modbm_core.purchase_order_lines pl
        JOIN modbm_core.purchase_orders po ON po.purchase_order_id = pl.purchase_order_id
        WHERE pl.product_id = p.product_id
          AND po.state_code NOT IN ('draft', 'cancelled')
          AND pl.quantity > COALESCE(pl.quantity_received, 0)
    ), 0) AS quantity_on_order
FROM modbm_core.products p
LEFT JOIN modbm_core.bin_contents bc ON bc.product_id = p.product_id
GROUP BY p.product_id;

-- 3. Create the automated Cache Syncer (Ledger -> Bin Contents)
CREATE OR REPLACE FUNCTION modbm_core.trg_sync_bin_contents()
RETURNS trigger AS $$
BEGIN
    INSERT INTO modbm_core.bin_contents (bin_id, product_id, actual_quantity, modified_on)
    VALUES (NEW.bin_id, NEW.product_id, NEW.quantity, NOW())
    ON CONFLICT (bin_id, product_id) DO UPDATE
    SET actual_quantity = modbm_core.bin_contents.actual_quantity + EXCLUDED.actual_quantity,
        modified_on = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sync_bin_contents_after_ledger_insert ON modbm_core.inventory_ledger;
CREATE TRIGGER sync_bin_contents_after_ledger_insert
AFTER INSERT ON modbm_core.inventory_ledger
FOR EACH ROW EXECUTE FUNCTION modbm_core.trg_sync_bin_contents();

-- 4. Create the Cache Protector (Block manual code modifications to bin_contents)
CREATE OR REPLACE FUNCTION modbm_core.trg_protect_bin_contents()
RETURNS trigger AS $$
BEGIN
    -- pg_trigger_depth() = 0 means the query was sent directly by the application API.
    -- Depth > 0 means it was fired securely by our inventory_ledger sync trigger.
    IF pg_trigger_depth() = 0 THEN
        RAISE EXCEPTION 'Direct modification of bin_contents is strictly prohibited. Mutate via inventory_ledger instead.';
    END IF;
    
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_bin_contents ON modbm_core.bin_contents;
CREATE TRIGGER protect_bin_contents
BEFORE INSERT OR UPDATE OR DELETE ON modbm_core.bin_contents
FOR EACH ROW EXECUTE FUNCTION modbm_core.trg_protect_bin_contents();
