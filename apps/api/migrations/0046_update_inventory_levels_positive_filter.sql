CREATE OR REPLACE VIEW modbm_core.inventory_levels AS
  SELECT 
      gen_random_uuid() AS inventory_level_id,
      l.location_id,
      p.product_id,
      COALESCE((
          SELECT sum(bc.actual_quantity)
          FROM modbm_core.bin_contents bc
          JOIN modbm_core.bins b ON b.bin_id = bc.bin_id
          JOIN modbm_core.zones z ON z.zone_id = b.zone_id
          WHERE bc.product_id = p.product_id
            AND z.location_id = l.location_id
            AND b.bin_type IN ('storage', 'pick', 'bulk')
            AND b.is_unavailable = false
            AND b.is_bonded = false
      ), 0::numeric) AS quantity_on_hand,
      COALESCE((( SELECT COALESCE(sum(b.quantity), 0::numeric) AS "coalesce"
             FROM modbm_core.backorders b
               JOIN modbm_core.sales_order_lines sol ON b.sales_order_line_id = sol.sales_order_line_id
            WHERE sol.product_id = p.product_id AND sol.fulfillment_location_id = l.location_id AND b.state_code = 
'received_reserved'::text)) + (( SELECT COALESCE(sum(sol.quantity - COALESCE(sol.quantity_picked, 0::numeric)), 
0::numeric) AS "coalesce"
             FROM modbm_core.sales_order_lines sol
               JOIN modbm_core.sales_orders so ON so.sales_order_id = sol.sales_order_id
            WHERE sol.product_id = p.product_id AND sol.fulfillment_location_id = l.location_id AND (so.state_code = 
ANY (ARRAY['confirmed'::text, 'picking'::text, 'partially_picked'::text, 'packed'::text, 
'partially_dispatched'::text])))), 0::numeric) AS quantity_committed,
      0 AS quantity_reserved,
      COALESCE(( SELECT sum(pol.quantity - pol.quantity_received) AS sum
             FROM modbm_core.purchase_order_lines pol
               JOIN modbm_core.purchase_orders po ON po.purchase_order_id = pol.purchase_order_id
            WHERE pol.product_id = p.product_id AND po.delivery_location_id = l.location_id AND (po.state_code <> ALL 
(ARRAY['draft'::text, 'cancelled'::text, 'completed'::text]))), 0::numeric) AS quantity_on_order
  FROM modbm_core.products p
  CROSS JOIN modbm_core.locations l;
