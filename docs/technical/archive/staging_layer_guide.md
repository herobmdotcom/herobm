---
id: tech-staging-layer
title: "Data Staging Layer & dbt Pipelines"
description: "dbt staging layer models, type casting rules, materialization strategies, and legacy raw data cleansing."
category: "Architecture & Engineering"
order: 13
resource: "system"
action: "read"
tags: ["dbt", "staging", "data-pipeline", "sql", "cleansing", "etl"]
---

# Staging Layer Guide

The dbt staging layer (`stg_*` models) provides a clean, type-safe interface over the raw ABM data loaded by `dlt` into the `raw_abm` schema. All staging models live in `pipelines/abm_transform/models/staging/` and materialise in the `public_staging` schema.

- **Most models** materialise as **views** (default).
- **Z-table models** (sales/purchasing operations) materialise as **tables** via `{{ config(materialized='table') }}`. This ensures their varchar→numeric casts happen once at `dbt run` time rather than on every downstream query, preventing runtime cast failures from propagating to import models.

## Architecture

```
ABM (MS SQL Server)
  │  pymssql + dlt
  ▼
raw_abm schema (Postgres)     ← Raw, dlt-managed tables
  │  dbt views + tables
  ▼
public_staging schema          ← This layer (20 views + 6 tables)
  │  dbt incremental models
  ▼
herobm_core schema              ← Application-owned tables (Drizzle ORM)
```

## What staging models do

Each `stg_*` model applies three transformations to the corresponding raw table:

1. **Rename** — ABM column names (e.g. `CustomerTitle`, `MailingStreet1`) become dbt-standard `snake_case` (e.g. `customer_name`, `address_line_1`).
2. **Clean** — `trim()` whitespace from varchar fields, `coalesce()` nulls to sensible defaults (`''` for strings, `0` for numbers, `false` for booleans).
3. **Cast** — Fix type mismatches introduced by ABM's storage model and dlt's type inference (see [Type Handling](#type-handling) below).

Staging models do **not** join tables, apply business logic, or filter rows. That work belongs in the import models (`models/import/`).

## Model inventory

### Master / Reference Data

| Model | Source table | Rows | Description |
|-------|-------------|------|-------------|
| `stg_customers` | `customers` | 17 | Customer master records |
| `stg_contacts` | `contacts` | 14 | Individual contact people |
| `stg_suppliers` | `suppliers` | 54 | Vendor/supplier master |
| `stg_products` | `products` | 14,896 | Product catalogue |
| `stg_company` | `company` | 1 | Tenant configuration |
| `stg_delivery_addresses` | `cdeladdresses` | 32 | Customer shipping addresses |
| `stg_product_groups` | `pgroups` | 29 | Product categories |
| `stg_product_units` | `punits` | 22 | Units of measure |
| `stg_product_kits` | `productkits` | 3,461 | BOMs / kit components |
| `stg_product_suppliers` | `psuppliers` | 9,301 | Product-supplier pricing links |
| `stg_price_list` | `g_price_list` | 232 | Customer-specific pricing matrix |
| `stg_product_averages` | `g_product_averages` | 75,022 | Rolling cost/sales averages |

### Stock / Warehouse

| Model | Source table | Rows | Description |
|-------|-------------|------|-------------|
| `stg_locations` | `plocations` | 2 | Physical warehouse locations |
| `stg_bins` | `pbins` | 4,730 | Bin definitions within locations |
| `stg_bin_contents` | `pbincontents` | 5,052 | Current stock per bin |
| `stg_location_details` | `plocdetails` | 19,023 | Product stock levels per location |
| `stg_bin_tracking` | `pbintracking` | 274,259 | Stock movement audit trail |

### Transactions

| Model | Source table | Rows | Description |
|-------|-------------|------|-------------|
| `stg_trans_headers` | `transheaders` | 244,505 | Transaction envelopes (all types) |
| `stg_trans_details` | `transdetails` | 633,690 | Transaction line items |
| `stg_trans_offsets` | `transoffsets` | 55,524 | Payment allocation records |

### Sales / Purchasing Operations (Z-tables)

| Model | Source table | Rows | Description |
|-------|-------------|------|-------------|
| `stg_sales_orders` | `zsales_orders` | 22,628 | Sales order lines |
| `stg_sales_deliveries` | `zsales_deliveries` | 17,154 | Sales delivery lines |
| `stg_sales_quotes` | `zsales_quotes` | 1,887 | Sales quote lines |
| `stg_sales_invoices` | `zsales_invoices` | 43,973 | Sales invoice lines |
| `stg_purchase_orders` | `zpurchase_orders` | 8,461 | Purchase order lines |
| `stg_purchase_invoices` | `zpurchase_invoices` | 77,283 | Purchase invoice lines |

## Type handling

ABM's data has two categories of type quirks that the staging layer must handle:

### 1. Z-tables: all numerics are `varchar` with commas

ABM's Z-tables (`zsales_*`, `zpurchase_*`) are denormalised report views. Every numeric column — quantities, prices, tax amounts, totals — is stored as `character varying` with:
- **Comma-thousands separators** (e.g. `"3,516.53"`)
- **Trailing whitespace** (e.g. `"3,516.53       "`)
- **Empty strings** for null values

A reusable `safe_cast_numeric` macro handles all three:
```sql
-- in the model:
{{ safe_cast_numeric('_qty_ordered') }}   as qty_ordered

-- expands to:
coalesce(nullif(trim(replace(_qty_ordered, ',', '')), '')::numeric, 0)
```
The macro lives in `macros/safe_cast_numeric.sql`. All Z-table models use it.

### 2. dlt maps many ABM IDs to `bigint`

Columns that look like string IDs in ABM (e.g. `bin_id`, `location_no`, `tracking_id`, `entry_user`) are inferred as `bigint` by dlt. These can't be used with `trim()` or `coalesce(col, '')`.

**Pattern used:**
```sql
bin_id::text                    as bin_id
location_no::text               as location_no
```

### Quick reference: which pattern to use

| Raw column type | Example columns | Staging pattern |
|----------------|-----------------|-----------------|
| `character varying` (text) | `customer_name`, `description` | `trim(coalesce(col, ''))` |
| `character varying` (numeric) | Z-table `_qty_ordered`, `total_ex_tax` | `{{ safe_cast_numeric('col') }}` |
| `bigint` (ID) | `bin_id`, `location_no`, `unique_id` | `col::text` |
| `bigint` (count) | `_line_number`, `period_no` | `coalesce(col, 0)` |
| `numeric` / `double precision` | `quantity`, `local_cost`, `average_value` | `coalesce(col, 0)` |
| `boolean` | `preferred`, `consignment` | `coalesce(col, false)` |
| `timestamp` | `trading_date`, `delivery_date` | Direct pass-through |

## Schema tests

Tests are defined in `_staging.yml` alongside the source definitions. Current coverage (39 tests):

- **PK uniqueness + not_null** on: `customers.unique_id`, `contacts.outlook_id`, `suppliers.unique_id`, `products.unique_id`, `productkits.kit_id`, `pbins.bin_id`, `plocations.location_no`, `transheaders.transaction_id`, `transdetails.line_item_id`, `pbintracking.tracking_id`, `transoffsets.offsets_key`
- **Referential integrity**: `transdetails.transaction_id → transheaders.transaction_id`
- **`is_valid_numeric`** on key Z-table varchar columns (quantities and totals for all 6 Z-tables — 15 tests). These catch non-numeric junk data before it causes a cast failure at materialisation time.

The `is_valid_numeric` generic test (`macros/test_is_valid_numeric.sql`) validates that all non-null, non-empty values in a varchar column match a numeric pattern after stripping commas.

Run tests with:
```bash
dbt test --profiles-dir . --project-dir .
```

## Naming conventions

Per [Phase 1 Requirements §4](phase_1_requirements.md), the staging layer uses **dbt-community conventions**:

- `snake_case` for all column names
- Entity-prefixed IDs where useful (e.g. `customer_id`, `product_code`)
- Timestamps as `*_date`, `*_at`, or descriptive names (`trading_date`, `updated_at`)
- Booleans as `is_*` or `has_*` (`is_primary`, `is_outstanding`, `has_been_printed`)

The **import layer** (above staging) uses [Microsoft CDM](https://learn.microsoft.com/en-us/common-data-model/) and [Schema.org](https://schema.org/) naming conventions when writing into `herobm_core`.

## How to add a new staging model

1. Ensure the raw table is declared as a source in `_staging.yml`
2. Query `information_schema.columns` to get the **actual** column names and types (dlt snake-cases them)
3. Create `stg_<entity>.sql` following the CTE pattern:
   ```sql
   with source as (
       select * from {{ source('raw_abm', '<table_name>') }}
   ),
   renamed as (
       select
           -- apply rename, clean, cast per type rules above
       from source
   )
   select * from renamed
   ```
4. Add PK tests to `_staging.yml`
5. Run `dbt run --select stg_<entity>` then `dbt test`
