# Database Seed Documentation

This document categorizes the essential system values (seeds) required for the HeroBM platform. These values are divided into **Core System Seeds** (managed by TypeScript seed runner `make seed`) and **Legacy Import Anchors** (managed by dbt pre_hooks during data migrations).

---

## 1. Core System Seeds (Required for all installations)
These records must exist for the application to function. They are managed by `make seed` (`apps/api/src/seeds/run.ts`).

### 1.1. System Singletons & Identity
| Entity | UUID | Code/Name | Purpose |
| :--- | :--- | :--- | :--- |
| **Organization** | `00000000-0000-0000-0000-000000000000` | Primary Org | Primary company identity record. |
| **Location** | `00000000-0000-0000-0000-000000000100` | `HQ` | Default fulfillment warehouse facility. |
| **Product** | `00000000-0000-0000-0000-000000000000` | `SYSTEM-CUSTOM-LINE` | Placeholder for non-catalog/custom line items. |

### 1.2. Reference Data
* **Default UOM:** `EA` (Each) — The baseline unit of measure for inventory calculations.
* **GST/VAT Categories:** Tax codes (e.g. `GST 10%`, `Tax Free`, `Input Taxed`).
* **Trading Terms:** Standard commercial payment terms (`COD`, `Net 30`, `Net 60`, `EOM`).

### 1.3. Financial Reference Data
* **GL Settings Singleton:** (ID: `4e185bce-d31a-4caa-8462-73c261864eff`) Anchors fiscal year, base currency, and default control accounts. **This is the single source of truth for `base_currency`.**
* **Chart of Accounts (COA):** Seeded via JSON presets (e.g. `au_standard.json`, `us_standard.json`) in `apps/api/src/gl/charts/`.

### 1.4. Security & Access
* **Roles:** `admin`, `sales`, `warehouse`, `procurement`, `finance`, `auditor`.
* **Casbin Policy Rules:** Populated into the `casbin_rules` table.

---

## 2. Seed Sources & Execution Order

| Source | Trigger | Contents |
| :--- | :--- | :--- |
| `apps/api/src/seeds/run.ts` | `make seed` | Users, Organization, Location, System Product, UOM, Casbin RBAC policies, Reports. |
| `SetupService` | Setup Wizard / CLI | COA hierarchy, GL Settings, Control Accounts, Tax Positions. |
| `dbt pre_hooks` | `make elt` | Legacy migration anchors and historical fallback entities. |

### Execution Order

```
make up-db           →  Start PostgreSQL container
make dev-db-migrate  →  Apply DDL migrations
make seed            →  Universal seeds (users, org/loc fallback, UOM, product, reports, Casbin)
Setup Wizard / CLI   →  COA, GL settings, App settings
```
