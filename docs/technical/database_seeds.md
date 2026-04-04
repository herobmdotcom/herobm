# Database Seed Documentation

This document outlines the essential system values (seeds) required for the HeroBM platform to function correctly. These values are populated through various mechanisms including `seed.py`, `dbt` import hooks, and the Setup Wizard.

## 1. Core System Anchors (Fixed UUIDs)
These records use deterministic UUIDs to maintain referential integrity across manual seeds, automated ELT, and the frontend.

| Entity | UUID | Code/Name | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Organization** | `00000000-0000-0000-0000-000000000000` | (Singleton) | `seed.py` | Primary company identity record. |
| **Product** | `00000000-0000-0000-0000-000000000000` | `SYSTEM-CUSTOM-LINE` | `seed.py` / `dbt` | Used for miscellaneous or custom order lines. |
| **Sales Order** | `00000000-0000-0000-0000-000000000001` | `LEGACY-SALES` / `DUMMY` | `seed.py` / `dbt` | Anchor for imported invoices without parent orders. |
| **Purchase Order** | `00000000-0000-0000-0000-000000000002` | `LEGACY-PURCHASE` / `DUMMY` | `seed.py` / `dbt` | Anchor for imported bills without parent orders. |
| **SO Line** | `00000000-0000-0000-0000-000000000010` | (System Line) | `seed.py` / `dbt` | Anchor for legacy sales events. |
| **PO Line** | `00000000-0000-0000-0000-000000000020` | (System Line) | `seed.py` / `dbt` | Anchor for legacy purchase events. |
| **Location** | `00000000-0000-0000-0000-000000000100` | `HQ` | `seed.py` | Default fulfillment location. |

## 2. Financial & Reference Data
Most of this data is seeded by the `CoaLoaderService` during the Setup Wizard using `au_standard_settings.json`.

### GST Categories
| Code | Title | Type | Rate | Default |
| :--- | :--- | :--- | :--- | :--- |
| `GST` | GST 10% | `gst_applies` | 10% | Yes |
| `FRE` | GST Free | `zero_rated` | 0% | No |
| `N-T` | Not Reportable | `exempt` | 0% | No |

### Trading Terms
| Code | Description | Days | Type |
| :--- | :--- | :--- | :--- |
| `COD` | Cash on Delivery | 0 | `cash_on_delivery` |
| `CIA` | Cash in Advance | 0 | `cash_on_delivery` |
| `NET7` | Net 7 Days | 7 | `net` |
| `NET14` | Net 14 Days | 14 | `net` |
| `NET30` | Net 30 Days | 30 | `net` |
| `EOM` | End of Month | 30 | `end_of_month` |

### Default GL Mappings
The system expects these account codes to exist in the Chart of Accounts:
- **Accounts Receivable:** `1100`
- **Accounts Payable:** `2100`
- **Revenue:** `4100`
- **COGS:** `5100`
- **Tax:** `2200`
- **Expense:** `6900`

### Unit of Measure
- **`EA` (Each):** Mandatory baseline unit, seeded by `seed.py` and `dbt` hooks.

## 3. Security & Access (Users)
Seeded by `seed.py` from `.env` variables. `init_env.py` ensures these are generated during environment setup.

*   **Users:** `admin`, `viewer`, `sales`, `warehouse`, `procurement`, `finance`.
*   **Roles:** admin, viewer, sales, warehouse, procurement, finance.

## 4. Configuration Singletons
These tables contain operational state and typically hold exactly one record.

*   **`gl_settings`** (ID: `4e185bce-d31a-4caa-8462-73c261864eff`): Stores fiscal year start, base currency, and routing precedence.
*   **`app_settings`**: Stores inventory valuation method, billing mode, and the `setupCompletedAt` flag.

## 5. Synchronization Strategy

| Scenario | Risk | Mitigation |
| :--- | :--- | :--- |
| **CLI Setup** | GST/Terms missing. | Logic should be added to `seed.py` to optionally load COA settings. |
| **Wizard Setup** | Legacy anchors missing. | `SetupService` calls `make seed` internally. |
| **Data Import** | UUID Mismatches. | All `dbt` hooks use the same deterministic UUIDs as `seed.py`. |
