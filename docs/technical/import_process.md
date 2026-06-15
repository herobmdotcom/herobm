# ABM Import Process

Technical reference for the ELT pipeline that imports legacy ABM data into the `herobm_core` schema.

## Architecture Overview

```
ABM ODBC → dlt extract → public_staging.* → dbt transform → herobm_core.*
                                                  ↓
                                          sync_* macros → order/quote lines
```

### Pipeline Phases

| Phase | Makefile Target | What It Does |
|---|---|---|
| **Extract** | `make extract` | Runs `dlt` to pull raw ABM tables into `public_staging` via ODBC |
| **Transform** | `make transform` | Runs all dbt models — staging views + incremental import models |
| **Import Legacy** | `make import-legacy` | Runs import models (tag:import) + sync macros for order lines |
| **Seed** | `make seed` | Seeds users, system product, system bins |

The full pipeline: `make elt` = extract → transform → import-legacy → schema-ref.
The fast-resume variant: `make elt-no-extract` skips the 15+ minute ODBC extraction.

## Import Model Inventory

All models live in `pipelines/abm_transform/models/import/`.

### Incremental Models (tag: `import`)

These use dbt's `merge` strategy to upsert into Drizzle-managed core tables:

| Model | Target Table | Unique Key | Notes |
|---|---|---|---|
| `import_accounts` | `accounts` | `source_id` | Resolves ABM customer_id → UUID |
| `import_products` | `products` | `source_id` | Resolves ABM product_id → UUID |
| `import_suppliers` | `suppliers` | `source_id` | Resolves ABM supplier_id → UUID |
| `import_sales_orders` | `sales_orders` | `source_id` | Groups line-level rows into headers |
| `import_sales_quotes` | `import_sales_quotes` | `source_id` | Staging table (NOT aliased to sales_orders) |
| `import_purchase_orders` | `purchase_orders` | `order_number` | Groups line-level rows into headers |
| `import_product_suppliers` | `product_suppliers` | `source_id` | DISTINCT ON dedup for duplicate pairs |
| `import_bins` | `bins` | `source_id` | Location/bin hierarchy |
| `import_bin_contents` | `bin_contents` | merged via compound key | Product-bin relationships |
| `import_inventory_entries` | `inventory_entries` | `entry_number` | Transaction headers |
| `import_inventory_ledger` | `inventory_ledger` | `source_id` | Ledger line items |
| `import_inventory` | `inventory_levels` | `source_id` | Snapshot levels |

### Sync Macros (run-operation)

These handle line-level data that depends on headers existing first:

| Macro | What It Does |
|---|---|
| `sync_sales_order_lines` | Inserts SO lines with FK to `sales_orders` and `products` |
| `sync_sales_quotes` | Inserts quote headers into `sales_orders` (state_code='quoted') |
| `sync_sales_quote_lines` | Inserts quote lines with FK to `sales_orders` and `products` |
| `sync_purchase_order_lines` | Inserts PO lines with FK to `purchase_orders` and `products` |

## The dbt Merge Contract

When an import model targets a Drizzle-managed table (via `alias`), dbt's merge has strict requirements:

### 1. Every destination column must appear in the SELECT

dbt's merge generates `UPDATE SET col = source.col` for **every column** in the target table. If the source SELECT omits a column, the merge fails:

```
column dbt_internal_source.external_id does not exist
```

**Fix:** Output typed NULLs for columns with no ABM equivalent:
```sql
null::text  as erpnext_id,
null::jsonb as custom_fields,
```

### 2. The UUID primary key must be in the SELECT

Drizzle tables use `gen_random_uuid()` defaults, but dbt needs the PK in the source query. Use the coalesce pattern to reuse existing UUIDs on re-runs:

```sql
with source_data as ( select ... )
select
    coalesce(dest.account_id, gen_random_uuid()) as account_id,
    s.*
from source_data s
left join herobm_core.accounts dest on dest.source_id = s.source_id
```

### 3. `--full-refresh` is prohibited

dbt renames the target to `<table>__dbt_backup` during full-refresh, which breaks FK constraints from other Drizzle tables. Only incremental merges are safe.

### 4. Staging data may contain duplicates

ABM's `product_suppliers` table has duplicate `(vendor_id, product_id)` pairs with different internal IDs. Use `DISTINCT ON` to resolve:

```sql
select distinct on (p.product_id, s.vendor_id) ...
order by p.product_id, s.vendor_id, rps.is_preferred desc nulls last
```

## Data Count Methodology

The test script `infra/tests/test_data_counts.py` validates staging↔core parity.

### Key Nuances

**ABM stores orders as flat line rows.** The staging tables `stg_sales_orders` and `stg_purchase_orders` contain one row per line item, not per order. A "staging count" of 22,630 for sales orders means 22,630 line items, which group into ~1,421 unique document headers.

**Quotes live in `sales_orders`.** ABM quotes are imported as `sales_orders` with `state_code = 'quoted'`. The test script separates them into distinct comparison rows:

- Sales Orders: staging headers (distinct doc#) vs core orders WHERE state_code != 'quoted'
- Sales Quotes: staging quote headers vs core orders WHERE state_code = 'quoted'

**Products has +1.** The core products table includes 1 seeded system record (`SYSTEM-CUSTOM-LINE`, UUID `00000000-...`) not in ABM.

## Constraint Integrity

The `herobm_core` schema has **115 constraints** across 42 tables:

- **Every table** has a UUID primary key with `gen_random_uuid()` default
- **All FK relationships** are enforced (e.g. `sales_order_lines.product_id → products.product_id`)
- **Business-key uniqueness** is enforced on natural keys (e.g. `order_number`, `account_number`, `source_id`)
- **Compound uniqueness** where needed (e.g. `bin_contents(bin_id, product_id)`, `product_suppliers(vendor_id, product_id)`)

### FK Chain for Import Order

Import order matters because FKs are enforced at insert time:

1. **accounts, products, suppliers, bins** — dimension tables with no FK dependencies on each other
2. **product_suppliers** — depends on products + suppliers
3. **sales_orders, purchase_orders** — depends on accounts / suppliers
4. **order lines** (sync macros) — depends on orders + products
5. **inventory (bins, entries, ledger)** — depends on products + bins
6. **invoices, shipments, returns** — depends on orders + lines

dbt handles this automatically via its DAG, and the sync macros run after import models.

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `column does not exist` on merge | Source SELECT missing a destination column | Add the column as a typed NULL |
| `already exists` on merge | Duplicate natural keys in staging | Add `DISTINCT ON` to dedup |
| 0 rows merged, no error | Model ran as no-op (cached state) | Check `target/run_results.json` |
| FK violation on full-refresh | dbt renamed table, orphaning FK refs | Never use `--full-refresh` on aliased models |
| Empty core tables after transform | Missing `alias` in config | Add `alias = '<drizzle_table>'` |

## Related Documentation

- [Convention §23: dbt Import Models](../conventions.md#23-dbt-import-models-targeting-drizzle-tables) — the checklist
- [Make Targets](./make_targets.md) — `elt`, `elt-no-extract`, `transform-refresh`, etc.
- [Install Guide](../user/install_guide.md) — setup instructions with fast-resume tips
