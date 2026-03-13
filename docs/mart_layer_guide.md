# Mart Layer Guide

The dbt mart layer (`mart_*` models) provides business-ready, typed, and relationally constrained tables built on top of the staging layer. All mart models live in `pipelines/abm_transform/models/marts/` and materialise as **tables** in the `public_marts` schema.

Mart models use **dbt Model Contracts** (`contract: enforced: true`), meaning every column has an explicit Postgres `data_type` and the DDL is generated with real database constraints (primary keys, foreign keys, not-null). If a model transformation produces the wrong type or violates a constraint, the build fails.

> [!IMPORTANT]
> **For column-level schema details** (types, constraints, join keys, and tests), see [`docs/schema_reference.md`](schema_reference.md). This is auto-generated from dbt metadata and is the authoritative reference for the mart layer's structure. Do not discover the schema by running exploratory queries.

## Architecture

```
public_staging schema (views + tables)
  │  dbt table materialisation
  ▼
public_marts schema (8 tables, contract-enforced)
  │
  ▼
Custom App API / UI
```

## What mart models do

Each `mart_*` model applies three transformations:

1. **Join** — Resolve foreign keys into human-readable names (e.g. `product_id` → `product_name`, `customer_code` → `account_name`).
2. **Rename** — Column names follow [Microsoft CDM](https://learn.microsoft.com/en-us/common-data-model/) or [Schema.org](https://schema.org/) vocabulary where applicable (e.g. `customer_id` → `account_id`, `customer_name` → `name`).
3. **Derive** — Compute business fields not present in staging (e.g. `quantity_available = qty_on_hand - qty_committed` in `mart_inventory`, `is_fully_delivered` in order lines).

Mart models generally do **not** filter rows, with one exception: `mart_sales_order_lines` excludes ABM header rows (`line_number = 9999`) that carry document totals but no line-item data. All other marts have a 1:1 row correspondence with their primary source staging model (verified by the row-count sanity test).

## Model inventory

### Master / Reference Data

| Model | Source staging models | Rows | Description |
|-------|---------------------|------|-------------|
| `mart_accounts` | `stg_customers`, `stg_contacts`, `stg_delivery_addresses` | 17 | Customer profiles with primary contact person and delivery address count |
| `mart_products` | `stg_products`, `stg_product_groups`, `stg_price_list`, `stg_product_kits` | 14,896 | Product catalogue with group name, `price_list_count`, and `is_kit` flag |
| `mart_suppliers` | `stg_suppliers`, `stg_product_suppliers` | 54 | Supplier/vendor master with `product_count` enrichment |

### Stock / Warehouse

| Model | Source staging models | Rows | Description |
|-------|---------------------|------|-------------|
| `mart_inventory` | `stg_location_details`, `stg_products`, `stg_locations`, `stg_bin_contents`, `stg_bins` | 19,023 | Stock position per product per location, with derived `quantity_available` and enriched `default_bin_number` from bin contents |
| `mart_bin_contents` | `stg_bin_contents`, `stg_bins`, `stg_products`, `stg_locations` | 5,052 | Bin-level stock for warehouse picking |

### Sales & Purchasing Operations

| Model | Source staging models | Rows | Description |
|-------|---------------------|------|-------------|
| `mart_sales_order_lines` | `stg_sales_orders`, `stg_customers`, `stg_products` | ~21k | Sales order line items with customer and product resolved, fulfilment flags. ABM header rows (line 9999) excluded. |
| `mart_sales_quote_lines` | `stg_sales_quotes`, `stg_customers`, `stg_products` | ~1.6k | Sales quote line items with customer and product resolved. No fulfilment tracking. Header rows excluded. |
| `mart_purchase_order_lines` | `stg_purchase_orders`, `stg_suppliers`, `stg_products` | ~7.8k | Purchase order line items with supplier and product resolved, fulfilment flags. Header rows excluded. |

## Constraint enforcement

All constraints are defined declaratively in `_marts.yml` and enforced at the Postgres DDL level by dbt's contract system.

### Primary keys

Every mart has a single-column primary key constraint:

| Model | PK column |
|-------|----------|
| `mart_accounts` | `account_id` |
| `mart_products` | `product_id` |
| `mart_suppliers` | `vendor_id` |
| `mart_inventory` | `inventory_level_id` |
| `mart_bin_contents` | `bin_contents_id` |
| `mart_sales_order_lines` | `sales_order_line_id` |
| `mart_sales_quote_lines` | `sales_quote_line_id` |
| `mart_purchase_order_lines` | `purchase_order_line_id` |

### Foreign keys

| Child model | FK column | → Parent model | Parent column |
|-------------|-----------|---------------|---------------|
| `mart_inventory` | `product_id` | `mart_products` | `product_id` |
| `mart_bin_contents` | `product_id` | `mart_products` | `product_id` |
| `mart_sales_order_lines` | `account_id` | `mart_accounts` | `account_id` |
| `mart_sales_order_lines` | `product_id` | `mart_products` | `product_id` |
| `mart_sales_quote_lines` | `account_id` | `mart_accounts` | `account_id` |
| `mart_sales_quote_lines` | `product_id` | `mart_products` | `product_id` |
| `mart_purchase_order_lines` | `vendor_id` | `mart_suppliers` | `vendor_id` |
| `mart_purchase_order_lines` | `product_id` | `mart_products` | `product_id` |

FK columns are nullable to handle orphaned references (see [Data anomalies](#data-anomalies) below).

## Schema tests

Tests are defined in `_marts.yml`. Current coverage (56 tests, of which 18 are mart-specific):

- **PK uniqueness** — implied by `primary_key` constraint (contract-enforced)
- **FK not_null** (warn severity) — on `product_id` in `mart_inventory`, `mart_bin_contents`, `mart_sales_order_lines`, `mart_sales_quote_lines`, `mart_purchase_order_lines`; on `account_id` in `mart_sales_order_lines`, `mart_sales_quote_lines`; on `vendor_id` in `mart_purchase_order_lines`
- **`accepted_values`** — on `state_code` in `mart_accounts` and `mart_products`
- **`not_negative`** — custom generic test on `quantity_on_hand` (inventory) and `quantity` (sales orders, purchase orders, sales quotes)
- **`not_negative` (warn)** — on `value_on_hand` and `last_in_unit_cost` (inventory). These are warnings because the negatives are sub-cent rounding artifacts and pseudo-product side-effects, not data corruption.
- **`mart_row_count_sanity`** — singular test verifying every mart's row count matches its source staging model exactly, catching join explosions or data loss
- **Source freshness** — configured in `_staging.yml` with `loaded_at_field` using dlt's `_dlt_load_id`. Warns after 36 hours, errors after 72 hours. Run with `dbt source freshness`.

### Custom generic test: `not_negative`

Located in `macros/test_not_negative.sql`. Returns rows where `{{ column_name }} < 0`:

```sql
select {{ column_name }}
from {{ model }}
where {{ column_name }} < 0
```

### Singular test: `mart_row_count_sanity`

Located in `tests/mart_row_count_sanity.sql`. Compares row counts between each mart and its primary source staging model. Fails if counts differ or any mart has zero rows.

## Naming conventions

Per [Phase 1 Requirements §4](phase_1_requirements.md), the marts layer uses **Microsoft CDM** and **Schema.org** naming:

| Convention | Examples |
|-----------|---------|
| CDM Account entity | `account_id`, `account_number`, `name`, `address1_line1`, `telephone1`, `email_address1`, `state_code`, `created_on` |
| CDM Product entity | `product_id`, `product_number`, `name`, `standard_cost`, `state_code`, `created_on` |
| Schema.org InventoryLevel | `inventory_level_id`, `quantity_on_hand`, `quantity_available` |
| CDM SalesOrderProduct | `sales_order_line_id`, `quantity`, `price_per_unit`, `amount`, `total_amount` |
| Derived booleans | `is_fully_delivered`, `is_fully_invoiced`, `is_consignment`, `is_bonded`, `is_unavailable` |

## Data anomalies

The following data quirks were discovered during development and are handled by the mart layer and its tests:

### 1. Orphaned product references (197 inventory rows, 1,915 order lines)

Products that have been deleted from the ABM product master still appear in `stg_location_details` and `stg_sales_orders`. In the marts, these resolve to `product_id = NULL` (via LEFT JOIN) so the FK constraint is satisfied but the product name and code are empty.

**Impact:** The `not_null` tests on FK columns use `severity: warn` to flag these without blocking the build. The `mart_inventory` model uses the resolved `p.product_id` from the LEFT JOIN (not the raw staging value) so that orphaned IDs become NULL rather than violating the FK.

### 2. Negative prices on discount line items (6 order lines)

Some sales order lines represent whole-order discounts (e.g. "Discount 10% on whole job"). These have a **negative `price_per_unit`**. This is valid ABM business logic — the discount is modelled as a line item with a negative unit price.

**Impact:** The `not_negative` test is intentionally **not** applied to `price_per_unit` or `amount`. It is only applied to `quantity` (which should never be negative).

### 3. Sub-cent rounding residuals on `value_on_hand` (28 inventory rows)

When the last unit of stock is consumed, the ERP's moving-average valuation sometimes leaves a sub-cent residual (max magnitude $0.008). All 28 affected rows have `quantity_on_hand = 0`.

**Impact:** `not_negative` test with `severity: warn` — flagged but does not block the pipeline.

### 4. Negative `last_in_unit_cost` on pseudo-products (3 inventory rows)

The pseudo-products `Discount`, `GST`, and one fitting have negative last-in costs. This is a side-effect of routing non-stock line items through the ABM costing engine.

**Impact:** `not_negative` test with `severity: warn` — flagged but does not block the pipeline.

### 5. ABM `state_code` is an internal classification code, not a status flag

The `status` column in ABM's CUSTOMERS, PRODUCTS, and SUPPLIERS tables was initially assumed to be a simple status flag (Active/Suspended/Hold). Investigation reveals it is actually an **ABM internal classification or analysis code**:

| Entity | Distinct values | Examples |
|---|---|---|
| Products | 1 (`A` only) | All 14,896 products are `A` |
| Customers | 4 (`A`, `A1`, `A2`, `A28`) | `A2` = main trading customers, `A` = intercompany |
| Suppliers | 11 (`A` through `A28`) | Codes appear to group suppliers by type or division |

**No codebook exists** in the extracted ABM database. The `BRANCHES` table (which might contain labels) is not currently extracted and may need to be checked via ABM's admin UI. For now, the `accepted_values` test on `mart_accounts` and `mart_products` enumerates the observed values. `mart_suppliers` does not use `accepted_values` because the code space is too wide and arbitrary.

### 6. `document_date` stored as text in source

The `document_date` field in `stg_sales_orders` is stored as `text` (varchar). The mart explicitly casts this to `timestamp with time zone` to enforce a proper date type in the contract.

## How to add a new mart model

1. Create `mart_<entity>.sql` in `models/marts/` with CTE-based joins:
   ```sql
   with orders as (
       select * from {{ ref('stg_sales_orders') }}
   ),
   customers as (
       select customer_id, customer_code
       from {{ ref('stg_customers') }}
   )
   select
       o.internal_key  as sales_order_line_id,
       c.customer_id   as account_id,
       -- ...
   from orders o
   left join customers c on c.customer_code = o.customer_code
   ```
2. Add the model to `_marts.yml` with `contract: enforced: true`
3. Define `data_type` for **every** column — the contract will reject mismatches
4. Add `constraints` for PK and FK relationships
5. Add data quality tests (`accepted_values`, `not_negative`, etc.)
6. Update `tests/mart_row_count_sanity.sql` with a new `UNION ALL` block
7. Run `make transform` then `make test-transform`
8. Run `make schema-ref` to regenerate the schema reference documentation

> [!TIP]
> `make elt` runs the full pipeline: **extract → transform → schema-ref**.
> To rebuild a single model: `make transform-select MODEL=mart_inventory`.
