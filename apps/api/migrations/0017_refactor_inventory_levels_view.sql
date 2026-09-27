-- Migration: 0017_refactor_inventory_levels_view
-- Purpose: Optimize herobm_core.inventory_levels view from O(N x M) Cartesian product to sparse aggregated CTEs,
--          include staging bins in physical on-hand quantity, and bound committed quantities.

DROP VIEW IF EXISTS herobm_core.inventory_levels;

CREATE VIEW herobm_core.inventory_levels AS
WITH 
-- 1. On Hand from bin contents (including storage, pick, bulk, and staging, excluding unavailable/bonded/consignment)
on_hand_agg AS (
    SELECT 
        bc.product_id,
        z.location_id,
        SUM(bc.actual_quantity) AS quantity_on_hand
    FROM herobm_core.bin_contents bc
    JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
    JOIN herobm_core.zones z ON z.zone_id = b.zone_id
    WHERE b.bin_type = ANY(ARRAY['storage'::herobm_core.bin_type_enum, 'pick'::herobm_core.bin_type_enum, 'bulk'::herobm_core.bin_type_enum, 'staging'::herobm_core.bin_type_enum])
      AND COALESCE(b.is_unavailable, false) = false
      AND COALESCE(b.is_bonded, false) = false
      AND COALESCE(b.is_consignment, false) = false
    GROUP BY bc.product_id, z.location_id
),
-- 2. Committed from open sales orders and received_reserved backorders
committed_backorders_agg AS (
    SELECT 
        sol.product_id,
        sol.fulfillment_location_id AS location_id,
        SUM(b.quantity) AS quantity_committed_bo
    FROM herobm_core.backorders b
    JOIN herobm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
    WHERE b.state_code = 'received_reserved'
    GROUP BY sol.product_id, sol.fulfillment_location_id
),
picks_agg AS (
    SELECT 
        sop.sales_order_line_id,
        SUM(sop.quantity) AS picked_qty
    FROM herobm_core.sales_order_picks sop
    GROUP BY sop.sales_order_line_id
),
committed_sales_orders_agg AS (
    SELECT 
        sol.product_id,
        sol.fulfillment_location_id AS location_id,
        SUM(GREATEST(0::numeric, sol.quantity - COALESCE(p.picked_qty, 0::numeric))) AS quantity_committed_so
    FROM herobm_core.sales_order_lines sol
    JOIN herobm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
    LEFT JOIN picks_agg p ON p.sales_order_line_id = sol.sales_order_line_id
    WHERE so.state_code = ANY(ARRAY['confirmed'::text, 'picking'::text])
      AND sol.fulfillment_location_id IS NOT NULL
    GROUP BY sol.product_id, sol.fulfillment_location_id
),
-- 3. On Order from open purchase orders
on_order_agg AS (
    SELECT 
        pol.product_id,
        po.delivery_location_id AS location_id,
        SUM(GREATEST(0::numeric, pol.quantity - COALESCE(pol.quantity_received, 0::numeric))) AS quantity_on_order
    FROM herobm_core.purchase_order_lines pol
    JOIN herobm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id
    WHERE po.state_code = ANY(ARRAY['ordered'::text, 'partially_received'::text])
      AND po.delivery_location_id IS NOT NULL
    GROUP BY pol.product_id, po.delivery_location_id
),
-- 4. Sparse (product_id, location_id) combinations that actually have activity
active_pairs AS (
    SELECT product_id, location_id FROM on_hand_agg
    UNION
    SELECT product_id, location_id FROM committed_backorders_agg
    UNION
    SELECT product_id, location_id FROM committed_sales_orders_agg
    UNION
    SELECT product_id, location_id FROM on_order_agg
)
SELECT 
    gen_random_uuid() AS inventory_level_id,
    ap.location_id,
    ap.product_id,
    COALESCE(oh.quantity_on_hand, 0::numeric) AS quantity_on_hand,
    COALESCE(bo.quantity_committed_bo, 0::numeric) + COALESCE(so.quantity_committed_so, 0::numeric) AS quantity_committed,
    0::numeric AS quantity_reserved,
    COALESCE(oo.quantity_on_order, 0::numeric) AS quantity_on_order
FROM active_pairs ap
LEFT JOIN on_hand_agg oh ON oh.product_id = ap.product_id AND oh.location_id = ap.location_id
LEFT JOIN committed_backorders_agg bo ON bo.product_id = ap.product_id AND bo.location_id = ap.location_id
LEFT JOIN committed_sales_orders_agg so ON so.product_id = ap.product_id AND so.location_id = ap.location_id
LEFT JOIN on_order_agg oo ON oo.product_id = ap.product_id AND oo.location_id = ap.location_id;
