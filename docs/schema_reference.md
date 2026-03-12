# Schema Reference

> Auto-generated from dbt metadata. Only documents the **mart layer**.
> Last generated: 2026-03-12 12:52 UTC
> Regenerate with: `make schema-ref`

**Postgres schema:** `public_marts`

All mart tables use **dbt Model Contracts** (🔒) with enforced data types and database-level constraints.

**Source freshness:**
 Last raw data load: `2026-03-11 21:04:54.892571+00`
 Freshness checks: warn after 36h, error after 72h

## Models

| Model | Rows | Description |
|-------|------|-------------|
| [`mart_accounts`](#mart_accounts) | 17 | Customer accounts with primary contact and delivery address count |
| [`mart_bin_contents`](#mart_bin_contents) | 5,052 | Bin-level stock for warehouse picking |
| [`mart_inventory`](#mart_inventory) | 19,023 | Stock position per product per location |
| [`mart_products`](#mart_products) | 14,896 | Product catalogue with group name resolved |
| [`mart_sales_order_lines`](#mart_sales_order_lines) | 21,207 | Sales order line items with customer and product resolved |

---

## Lineage

```mermaid
graph LR
    stg_bin_contents["stg_bin_contents"]
    stg_bins["stg_bins"]
    stg_contacts["stg_contacts"]
    stg_customers["stg_customers"]
    stg_delivery_addresses["stg_delivery_addresses"]
    stg_location_details["stg_location_details"]
    stg_locations["stg_locations"]
    stg_product_groups["stg_product_groups"]
    stg_products["stg_products"]
    stg_sales_orders["stg_sales_orders"]
    mart_accounts["mart_accounts"]:::mart
    mart_bin_contents["mart_bin_contents"]:::mart
    mart_inventory["mart_inventory"]:::mart
    mart_products["mart_products"]:::mart
    mart_sales_order_lines["mart_sales_order_lines"]:::mart
    stg_customers --> mart_accounts
    stg_contacts --> mart_accounts
    stg_delivery_addresses --> mart_accounts
    stg_bin_contents --> mart_bin_contents
    stg_bins --> mart_bin_contents
    stg_products --> mart_bin_contents
    stg_locations --> mart_bin_contents
    mart_products --> mart_bin_contents
    stg_location_details --> mart_inventory
    stg_products --> mart_inventory
    stg_locations --> mart_inventory
    mart_products --> mart_inventory
    stg_products --> mart_products
    stg_product_groups --> mart_products
    stg_sales_orders --> mart_sales_order_lines
    stg_customers --> mart_sales_order_lines
    stg_products --> mart_sales_order_lines
    mart_accounts --> mart_sales_order_lines
    mart_products --> mart_sales_order_lines
    classDef mart fill:#2d6a4f,stroke:#1b4332,color:#fff
```

---

## Join Reference

| From | Join column | → To | Key column |
|------|------------|------|------------|
| `mart_bin_contents` | `product_id` | `mart_products` | `product_id` |
| `mart_inventory` | `product_id` | `mart_products` | `product_id` |
| `mart_sales_order_lines` | `account_id` | `mart_accounts` | `account_id` |
| `mart_sales_order_lines` | `product_id` | `mart_products` | `product_id` |

---

### `public_marts.mart_accounts` (17 rows)

Customer accounts with primary contact and delivery address count. CDM entity: Account.

**Staging sources:** `stg_customers`, `stg_contacts`, `stg_delivery_addresses`

**Model tests:** `mart_row_count_sanity`

| # | Column | Type | Constraints | Tests | Description |
|---|--------|------|-------------|-------|-------------|
| 1 | `account_id` | `text` | primary_key |  | Unique customer identifier (ABM UniqueID) |
| 2 | `account_number` | `text` |  |  |  |
| 3 | `name` | `text` |  |  |  |
| 4 | `address1_line1` | `text` |  |  |  |
| 5 | `address1_line2` | `text` |  |  |  |
| 6 | `address1_city` | `text` |  |  |  |
| 7 | `address1_state_or_province` | `text` |  |  |  |
| 8 | `address1_postal_code` | `text` |  |  |  |
| 9 | `address1_country` | `text` |  |  |  |
| 10 | `telephone1` | `text` |  |  |  |
| 11 | `fax` | `text` |  |  |  |
| 12 | `email_address1` | `text` |  |  |  |
| 13 | `primary_contact_name` | `text` |  |  |  |
| 14 | `primary_contact_email` | `text` |  |  |  |
| 15 | `primary_contact_phone` | `text` |  |  |  |
| 16 | `customer_group` | `text` |  |  |  |
| 17 | `state_code` | `text` |  | accepted_values('', 'A', 'S', 'H', 'A1', 'A2', 'A28') |  |
| 18 | `created_on` | `timestamp with time zone` |  |  |  |
| 19 | `delivery_address_count` | `bigint` |  |  |  |

> [!NOTE]
> **Data quirks:**
> - Status codes include legacy classifications `A1`, `A2`, `A28` beyond standard `A`/`S`/`H`.

### `public_marts.mart_bin_contents` (5,052 rows)

Bin-level stock for warehouse picking. Custom entity: BinStock.

**Mart dependencies:** `mart_products`
**Staging sources:** `stg_bin_contents`, `stg_bins`, `stg_products`, `stg_locations`

**Model tests:** `mart_row_count_sanity`

| # | Column | Type | Constraints | Tests | Description |
|---|--------|------|-------------|-------|-------------|
| 1 | `bin_contents_id` | `text` | primary_key |  | Unique bin-contents identifier |
| 2 | `bin_id` | `text` | not_null |  |  |
| 3 | `bin_number` | `text` |  |  |  |
| 4 | `bin_type` | `text` |  |  |  |
| 5 | `location_no` | `text` |  |  |  |
| 6 | `location_name` | `text` |  |  |  |
| 7 | `product_id` | `text` | foreign_key → mart_products(product_id) | not_null (warn) |  |
| 8 | `product_number` | `text` |  |  |  |
| 9 | `product_name` | `text` |  |  |  |
| 10 | `actual_quantity` | `numeric` |  |  |  |
| 11 | `base_quantity` | `numeric` |  |  |  |
| 12 | `is_consignment` | `boolean` |  |  |  |
| 13 | `is_bonded` | `boolean` |  |  |  |
| 14 | `is_unavailable` | `boolean` |  |  |  |

### `public_marts.mart_inventory` (19,023 rows)

Stock position per product per location. Schema.org entity: InventoryLevel.

**Mart dependencies:** `mart_products`
**Staging sources:** `stg_location_details`, `stg_products`, `stg_locations`

**Model tests:** `mart_row_count_sanity`

| # | Column | Type | Constraints | Tests | Description |
|---|--------|------|-------------|-------|-------------|
| 1 | `inventory_level_id` | `text` | primary_key |  | Unique location-detail identifier |
| 2 | `product_id` | `text` | foreign_key → mart_products(product_id) | not_null (warn) |  |
| 3 | `product_number` | `text` |  |  |  |
| 4 | `product_name` | `text` |  |  |  |
| 5 | `location_no` | `text` |  |  |  |
| 6 | `location_name` | `text` |  |  |  |
| 7 | `quantity_on_hand` | `numeric` |  | not_negative |  |
| 8 | `quantity_committed` | `numeric` |  |  |  |
| 9 | `quantity_on_order` | `numeric` |  |  |  |
| 10 | `quantity_available` | `numeric` |  |  |  |
| 11 | `quantity_reserved` | `numeric` |  |  |  |
| 12 | `quantity_back_ordered` | `numeric` |  |  |  |
| 13 | `min_quantity` | `numeric` |  |  |  |
| 14 | `max_quantity` | `numeric` |  |  |  |
| 15 | `value_on_hand` | `numeric` |  | not_negative (warn) |  |
| 16 | `last_in_unit_cost` | `numeric` |  | not_negative (warn) |  |
| 17 | `default_bin_number` | `text` |  |  |  |

> [!NOTE]
> **Data quirks:**
> - `quantity_available` can be legitimately negative (oversold stock: `qty_on_hand - qty_customer_orders`).
> - `value_on_hand` has 28 sub-cent rounding residuals (max magnitude $0.008) on zero-stock items — ERP moving-average artefact.
> - `last_in_unit_cost` is negative for 3 pseudo-products (`Discount`, `GST`, one fitting) — side-effect of routing non-stock line items through the costing engine.

### `public_marts.mart_products` (14,896 rows)

Product catalogue with group name resolved. CDM entity: Product.

**Staging sources:** `stg_products`, `stg_product_groups`

**Model tests:** `mart_row_count_sanity`

| # | Column | Type | Constraints | Tests | Description |
|---|--------|------|-------------|-------|-------------|
| 1 | `product_id` | `text` | primary_key |  | Unique product identifier (ABM UniqueID) |
| 2 | `product_number` | `text` |  |  |  |
| 3 | `name` | `text` |  |  |  |
| 4 | `product_group_name` | `text` |  |  |  |
| 5 | `default_vendor_id` | `text` |  |  |  |
| 6 | `default_vendor_name` | `text` |  |  |  |
| 7 | `standard_cost` | `numeric` |  |  |  |
| 8 | `quantity_on_hand` | `numeric` |  |  |  |
| 9 | `quantity_available` | `numeric` |  |  |  |
| 10 | `barcode` | `text` |  |  |  |
| 11 | `state_code` | `text` |  | accepted_values('', 'A', 'S', 'H', 'D') |  |
| 12 | `created_on` | `timestamp with time zone` |  |  |  |

> [!NOTE]
> **Data quirks:**
> - Includes system pseudo-products (e.g., `Discount`, `GST`) that have zero stock and anomalous `last_in_unit_cost` values. These are not real inventory items.

### `public_marts.mart_sales_order_lines` (21,207 rows)

Sales order line items with customer and product resolved. CDM entity: SalesOrderProduct.
Header rows (`line_number = 9999`) are excluded. `order_reference` = `coalesce(order_number, document_number)`.

**Mart dependencies:** `mart_accounts`, `mart_products`
**Staging sources:** `stg_sales_orders`, `stg_customers`, `stg_products`

**Model tests:** `mart_row_count_sanity`

| # | Column | Type | Constraints | Tests | Description |
|---|--------|------|-------------|-------|-------------|
| 1 | `sales_order_line_id` | `text` | primary_key |  | Unique line identifier (ABM InternalKey) |
| 2 | `line_item_id` | `text` |  |  |  |
| 3 | `line_number` | `bigint` |  |  |  |
| 4 | `order_reference` | `text` |  |  | Primary order identifier: prefers `order_number`, falls back to `document_number` |
| 5 | `document_number` | `text` |  |  |  |
| 6 | `document_date` | `timestamp with time zone` |  |  |  |
| 7 | `order_number` | `text` |  |  |  |
| 8 | `customer_order_number` | `text` |  |  |  |
| 9 | `account_id` | `text` | foreign_key → mart_accounts(account_id) | not_null (warn) |  |
| 10 | `account_number` | `text` |  |  |  |
| 11 | `account_name` | `text` |  |  |  |
| 12 | `product_id` | `text` | foreign_key → mart_products(product_id) | not_null (warn) |  |
| 13 | `product_number` | `text` |  |  |  |
| 14 | `product_description` | `text` |  |  |  |
| 15 | `unit_of_measure` | `text` |  |  |  |
| 16 | `quantity` | `numeric` |  | not_negative |  |
| 17 | `price_per_unit` | `numeric` |  |  |  |
| 18 | `discount_percentage` | `numeric` |  |  |  |
| 19 | `amount` | `numeric` |  |  |  |
| 20 | `tax` | `numeric` |  |  |  |
| 21 | `total_amount` | `numeric` |  |  |  |
| 22 | `quantity_delivered` | `numeric` |  |  |  |
| 23 | `quantity_invoiced` | `numeric` |  |  |  |
| 24 | `is_fully_delivered` | `boolean` |  |  |  |
| 25 | `is_fully_invoiced` | `boolean` |  |  |  |
| 26 | `document_total_ex_tax` | `numeric` |  |  |  |
| 27 | `document_total_tax` | `numeric` |  |  |  |
| 28 | `document_total_inc_tax` | `numeric` |  |  |  |

> [!NOTE]
> **Data quirks:**
> - ABM models **discounts as negative line items** (`product_number = 'Discount'`). `price_per_unit`, `amount`, `tax`, and `total_amount` are intentionally negative on these rows. `not_negative` is intentionally **not** applied to financial columns.
> - `document_date` is cast from `text` → `timestamp with time zone` in the mart SQL.
> - ABM's **header rows** (`line_number = 9999`) carry document totals but no line-item data. These are filtered out in the mart. Document totals are denormalised onto every line row by ABM, so no data is lost.
> - `order_number` (ABM `our_order_no`) is often empty. The `order_reference` column provides a guaranteed non-empty identifier by falling back to `document_number`.
