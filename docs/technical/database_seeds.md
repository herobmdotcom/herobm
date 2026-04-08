# Database Seed Documentation

This document categorizes the essential system values (seeds) required for the HeroBM platform. These values are divided into **Core System Seeds** (required for all installations, managed by `seed.py`) and **Legacy Import Anchors** (required for data migration, managed by dbt pre_hooks).

---

## 1. Core System Seeds (Required for all cases)
These records must exist for the application to function, regardless of whether legacy data is imported. They are managed exclusively by `seed.py` (`make seed`).

### 1.1. System Singletons & Identity
| Entity | UUID | Code/Name | Purpose |
| :--- | :--- | :--- | :--- |
| **Organization** | `00000000-0000-0000-0000-000000000000` | (Singleton) | Primary company identity record. Inserted only if no organization record exists. Overwritten by dbt ABM import if ELT runs. |
| **Location** | `00000000-0000-0000-0000-000000000100` | `HQ` | Default fulfillment location. Created only if zero locations exist in the DB. |
| **Product** | `00000000-0000-0000-0000-000000000000` | `SYSTEM-CUSTOM-LINE` | Placeholder for non-catalog/custom order lines. |

### 1.2. Reference Data (from `seed.py`)
*   **Default UOM:** `EA` (Each) — The baseline unit for inventory calculations.

### 1.3. Financial Reference Data (from Setup Wizard / CLI)
Seeded by `CoaLoaderService` via a settings JSON (e.g., `au_standard_settings.json`) during the Setup Wizard or CLI setup.

*   **GST Categories:** Region-specific tax codes (e.g., `GST`, `FRE`, `N-T`).
*   **Trading Terms:** Payment terms (e.g., `COD`, `NET30`, `EOM`).
*   **GL Settings Singleton:** (ID: `4e185bce-d31a-4caa-8462-73c261864eff`) Anchors fiscal year, base currency, and routing precedence. **This is the single source of truth for `base_currency`.**
*   **Exchange Rate Anchor:** Seed the home currency at rate 1.0 — created by a dbt post_hook that reads `base_currency` from `gl_settings`.

### 1.4. Security & Access
Seeded by `seed.py` using `.env` variables.
*   **Users:** `admin`, `viewer`, `sales`, `warehouse`, `procurement`, `finance`.

---

## 2. Legacy Import Anchors (Required for ELT)
These records are specifically designed to handle data integrity issues during migration from the legacy ABM system. They are managed by **dbt pre_hooks** inside the import models, not by `seed.py`.

| Entity | UUID | Code/Name | Managed By | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Sales Order** | `00000000-0000-0000-0000-000000000001` | `LEGACY-SALES` | `import_sales_orders.sql` pre_hook | Parent for imported Sales Invoices that lack a matching Order. |
| **Purchase Order** | `00000000-0000-0000-0000-000000000002` | `LEGACY-PURCHASE` | `import_purchase_orders.sql` pre_hook | Parent for imported Purchase Invoices that lack a matching PO. |
| **SO Line** | `00000000-0000-0000-0000-000000000010` | (System Line) | `import_sales_orders.sql` pre_hook | Anchor for legacy sales events and history. |
| **PO Line** | `00000000-0000-0000-0000-000000000020` | (System Line) | `import_purchase_orders.sql` pre_hook | Anchor for legacy purchase events and history. |
| **Organization** | *(overwrite)* | *(from ABM)* | `import_organization.sql` | Imports company details from `raw_abm.company`, overwriting the seed fallback. |

---

## 3. Seed Sources & Execution Order

| Source | Trigger | Contents |
| :--- | :--- | :--- |
| `seed.py` | `make seed` | Users, Organization (fallback), Location (fallback), System Product, UOM, Reports. |
| `execute-setup.ts` | `npm run setup` | **Unified CLI Setup:** Calls `SetupService.runSetupCore`. Seeds COA, GL Settings, App Settings, Organization. |
| `coa-loader.ts` | Setup Wizard | **Unified UI Setup:** Calls `SetupService.runSetupCore`. Seeds COA, GL Settings, Trading Terms. |
| `dbt pre_hooks` | `make elt` | LEGACY-SALES/PURCHASE anchors, SYSTEM-CUSTOM-LINE product, exchange rate anchor. |
| `dbt post_hooks` | `make elt` | Inventory aggregate sync (`products.quantity_on_hand`). |
| `dbt import model` | `make elt` | Organization details from `raw_abm.company`. |

### Execution Order

```
make init-db     →  Create database + schemas
make migrate     →  Apply DDL migrations
make seed        →  Universal seeds (users, org/loc fallback, UOM, product, reports)
Setup Wizard/CLI →  COA, GL settings (base_currency), App settings
make elt         →  Extract + Transform + Import (dbt creates LEGACY anchors, exchange rate, org import, inventory sync)
```

> **Important:** `make seed` and Setup must complete before `make elt` so that `gl_settings.base_currency` is available for dbt hooks.

## 4. Environment Synchronization
- **Sterile (No Import):** Run `make seed` then complete the **Setup Wizard** (UI) or `npm run setup` (CLI).
- **Migration (With Import):** The Setup Wizard orchestrates the full flow: seed → COA → GL → ELT → finalize.
- **Re-runs:** Both `make seed` and `make elt` are idempotent and safe to re-run.
