-- 0029: Add min/max quantities and convert inventory_levels.product_id to UUID FK

-- 1. Add minimum and maximum quantities for replenishment features
ALTER TABLE modbm_core.inventory_levels ADD COLUMN min_quantity numeric NOT NULL DEFAULT 0;
ALTER TABLE modbm_core.inventory_levels ADD COLUMN max_quantity numeric NOT NULL DEFAULT 0;

-- 2. Clean up inventory levels that refer to products not in the core database
DELETE FROM modbm_core.inventory_levels il
WHERE NOT EXISTS (
    SELECT 1 FROM modbm_core.products p
    WHERE p.source_id = il.product_id
);

-- 3. Update the text product_id (which holds ABM source_id) to the actual modbm_core UUID
UPDATE modbm_core.inventory_levels il
SET product_id = p.product_id::text
FROM modbm_core.products p
WHERE il.product_id = p.source_id;

-- 4. Cast the column type to native UUID
ALTER TABLE modbm_core.inventory_levels 
  ALTER COLUMN product_id TYPE uuid USING product_id::uuid;

-- 5. Establish foreign key constraint mapping back to core products
ALTER TABLE modbm_core.inventory_levels 
  ADD CONSTRAINT inventory_levels_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES modbm_core.products(product_id) ON DELETE CASCADE;
