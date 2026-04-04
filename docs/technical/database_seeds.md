# Database Seed Documentation

This document categorizes the essential system values (seeds) required for the HeroBM platform. These values are divided into **Core System Seeds** (required for all installations) and **Legacy Import Anchors** (required specifically for data migration from the ABM system).

---

## 1. Core System Seeds (Required for all cases)
These records must exist for the application to function, regardless of whether legacy data is imported.

### 1.1. System Singletons & Identity
| Entity | UUID | Code/Name | Source | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Organization** | `00000000-0000-0000-0000-000000000000` | (Singleton) | `seed.py` | Primary company identity record used in headers/reports. |
| **Location** | `00000000-0000-0000-0000-000000000100` | `HQ` | `seed.py` | Default fulfillment location for new orders. |
| **Product** | `00000000-0000-0000-0000-000000000000` | `SYSTEM-CUSTOM-LINE` | `seed.py` | Used as a placeholder for non-catalog/custom order lines. |

### 1.2. Financial Reference Data
Primarily seeded by `CoaLoaderService` via `au_standard_settings.json`.

*   **GST Categories:** `GST` (10%), `FRE` (Free), `N-T` (Not Reportable).
*   **Trading Terms:** `COD`, `CIA`, `NET7`, `NET14`, `NET30`, `EOM`.
*   **Default UOM:** `EA` (Each) - The baseline unit for inventory calculations.
*   **GL Settings Singleton:** (ID: `4e185bce-d31a-4caa-8462-73c261864eff`) Anchors fiscal year and base currency.

### 1.3. Security & Access
Seeded by `seed.py` using `.env` variables.
*   **Users:** `admin`, `viewer`, `sales`, `warehouse`, `procurement`, `finance`.

---

## 2. Legacy Import Anchors (Required for ELT)
These records are specifically designed to handle data integrity issues during the migration from the legacy ABM system. They provide "dummy" parents for orphaned records (e.g., invoices without an original order).

| Entity | UUID | Code/Name | Purpose |
| :--- | :--- | :--- | :--- |
| **Sales Order** | `00000000-0000-0000-0000-000000000001` | `LEGACY-SALES` | Parent for imported Sales Invoices that lack a matching Order in ABM. |
| **Purchase Order** | `00000000-0000-0000-0000-000000000002` | `LEGACY-PURCHASE` | Parent for imported Purchase Invoices/Bills that lack a matching PO. |
| **SO Line** | `00000000-0000-0000-0000-000000000010` | (System Line) | Anchor for legacy sales events and history. |
| **PO Line** | `00000000-0000-0000-0000-000000000020` | (System Line) | Anchor for legacy purchase events and history. |

---

## 3. Seed Sources & Execution

| Source | Trigger | Contents |
| :--- | :--- | :--- |
| `seed.py` | `make seed` | Users, Organization, HQ Location, Legacy Anchors, System Product. |
| `coa-loader.ts` | Setup Wizard | GST Categories, Trading Terms, GL Settings, Chart of Accounts. |
| `dbt hooks` | `make elt` | Re-seeds Legacy Anchors and System Product to ensure referential integrity during import. |

## 4. Environment Synchronization
- **Sterile (No Import):** Run `make seed` then complete the **Setup Wizard**.
- **Migration (With Import):** `make seed` is called automatically by `make elt` or the **Setup Wizard** to ensure all anchors are in place before data arrives.
