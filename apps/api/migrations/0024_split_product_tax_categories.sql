-- Phase 2: Split Product Tax Categories

-- 1. Add new columns
ALTER TABLE modbm_core.products ADD COLUMN purchase_tax_category_id uuid;
ALTER TABLE modbm_core.products ADD COLUMN sales_tax_category_id uuid;

-- 2. Add Foreign Keys
ALTER TABLE modbm_core.products
  ADD CONSTRAINT products_purchase_tax_category_id_fkey FOREIGN KEY (purchase_tax_category_id) REFERENCES modbm_core.tax_categories (tax_category_id);
ALTER TABLE modbm_core.products
  ADD CONSTRAINT products_sales_tax_category_id_fkey FOREIGN KEY (sales_tax_category_id) REFERENCES modbm_core.tax_categories (tax_category_id);

-- 3. Backfill data
UPDATE modbm_core.products 
SET purchase_tax_category_id = tax_category_id, 
    sales_tax_category_id = tax_category_id;

-- 4. Drop old column
ALTER TABLE modbm_core.products DROP COLUMN tax_category_id;
