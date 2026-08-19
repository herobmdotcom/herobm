CREATE OR REPLACE VIEW herobm_core.inventory_levels AS
 SELECT gen_random_uuid() AS inventory_level_id,
    l.location_id,
    p.product_id,
    COALESCE(( SELECT sum(bc.actual_quantity) AS sum
           FROM herobm_core.bin_contents bc
             JOIN herobm_core.bins b ON b.bin_id = bc.bin_id
             JOIN herobm_core.zones z ON z.zone_id = b.zone_id
          WHERE bc.product_id = p.product_id AND z.location_id = l.location_id AND (b.bin_type <> ALL (ARRAY['staging'::herobm_core.bin_type_enum, 'quarantine'::herobm_core.bin_type_enum])) AND COALESCE(b.is_unavailable, false) = false AND COALESCE(b.is_bonded, false) = false), 0::numeric) AS quantity_on_hand,
    COALESCE((
    (( SELECT COALESCE(sum(sol.quantity - COALESCE(( SELECT sum(sop.quantity) AS sum
                   FROM herobm_core.sales_order_picks sop
                  WHERE sop.sales_order_line_id = sol.sales_order_line_id AND sop.state_code <> 'cancelled'), 0::numeric)), 0::numeric) AS "coalesce"
           FROM herobm_core.sales_order_lines sol
             JOIN herobm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
          WHERE sol.product_id = p.product_id AND sol.fulfillment_location_id = l.location_id AND (so.state_code = ANY (ARRAY['confirmed'::text, 'picking'::text, 'partially_picked'::text, 'packed'::text, 'partially_dispatched'::text])))) + 
    (( SELECT COALESCE(sum((sol.quantity - COALESCE(( SELECT sum(sop.quantity) AS sum
                   FROM herobm_core.sales_order_picks sop
                  WHERE sop.sales_order_line_id = sol.sales_order_line_id AND sop.state_code <> 'cancelled'), 0::numeric)) * (pc.quantity / COALESCE(NULLIF(pc.parent_quantity, 0), 1))), 0::numeric) AS "coalesce"
           FROM herobm_core.sales_order_lines sol
             JOIN herobm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
             JOIN herobm_core.products kit_p ON sol.product_id = kit_p.product_id
             JOIN herobm_core.product_components pc ON pc.parent_product_id = kit_p.product_id
          WHERE pc.child_product_id = p.product_id AND kit_p.product_type = 'non-stock' AND kit_p.structure_type = 'kit' AND sol.fulfillment_location_id = l.location_id AND (so.state_code = ANY (ARRAY['confirmed'::text, 'picking'::text, 'partially_picked'::text, 'packed'::text, 'partially_dispatched'::text]))))
    ), 0::numeric) AS quantity_committed,
    0 AS quantity_reserved,
    COALESCE(( SELECT sum(pol.quantity - pol.quantity_received) AS sum
           FROM herobm_core.purchase_order_lines pol
             JOIN herobm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id
          WHERE pol.product_id = p.product_id AND po.delivery_location_id = l.location_id AND (po.state_code <> ALL (ARRAY['draft'::text, 'cancelled'::text, 'completed'::text]))), 0::numeric) AS quantity_on_order
   FROM herobm_core.products p
     CROSS JOIN herobm_core.locations l;
