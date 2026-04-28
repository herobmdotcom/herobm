-- Phase 1: Rename GST → Tax (hand-written, NOT auto-generated)
-- This migration renames tables, columns, indexes and enum values.
-- It is purely structural — no data is lost.

-- 1. Rename the table
ALTER TABLE modbm_core.gst_categories RENAME TO tax_categories;

-- 2. Rename the PK column on tax_categories
ALTER TABLE modbm_core.tax_categories RENAME COLUMN gst_category_id TO tax_category_id;

-- 3. Rename the unique partial index
ALTER INDEX modbm_core.gst_categories_single_default_idx RENAME TO tax_categories_single_default_idx;

-- 4. Rename FK columns on referencing tables
ALTER TABLE modbm_core.sales_order_lines RENAME COLUMN gst_category_id TO tax_category_id;
ALTER TABLE modbm_core.purchase_order_lines RENAME COLUMN gst_category_id TO tax_category_id;
ALTER TABLE modbm_core.products RENAME COLUMN gst_category_id TO tax_category_id;
ALTER TABLE modbm_core.accounts RENAME COLUMN gst_category_id TO tax_category_id;

-- 5. Update the type enum value
UPDATE modbm_core.tax_categories SET type = 'tax_applies' WHERE type = 'gst_applies';
