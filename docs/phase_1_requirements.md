# Phase 1: Data Extraction Requirements

This document outlines the business and technical requirements for Phase 1 (Extracting data from ABM to Postgres).

## 1. Acceptable Sync Latency
Given the historically low data volumes in the source application, the architecture will target **Near Real-Time ("Minutes" Latency)** across all operational phases.

This ensures that as users begin interacting with the new Custom App (e.g., viewing stock, looking up customer history), the data is sufficiently fresh to avoid business disruption, removing the need for separate SLAs between read-heavy and write-heavy phases.

## 2. Extraction Scope (Which Data?)
*Defining exactly which master data records and transactional data states need to be migrated in Phase 1 to support the new Custom App.*

### 2.1. Core Master Entities
*   **Customers:** `CUSTOMERS`, `CONTACTS`, Shipping Addresses (`CDELADDRESSES`).
*   **Products:** `PRODUCTS`, `PRODUCTKITS`, Pricing Data (`gPriceList`, `gProductAverages`, `PSUPPLIERS`), Bills of Materials.
*   **Suppliers:** `SUPPLIERS`.
*   **Locations:** Physical Warehouses and Bins (`PLOCATIONS`, `PBINS`).
*   **System/Tenant context:** `COMPANY`, `BRANCHES` (if multi-branch routing is needed).

### 2.2. Transactional / State Data (In-Flight Operations)
To support early workflow discovery and transition, we will extract:
*   **Current Stock Balances:** Live bin-by-bin breakdown (`PBINCONTENTS`, `PBINS`, `PLOCDETAILS`).
*   **Open Operations:** Open Sales Orders (`ZSALES_ORDERS`), Purchase Orders (`ZPURCHASE_ORDERS`), and Quotes (`ZSALES_QUOTES`).
*   *Note: Customer Financial Balances (`LBALANCES`, `gAgedCustomerTrans`, etc.) are explicitly excluded from this Custom Postgres sync, as they will be handled directly via ERPNext in a later phase.*

*(Note: The exact list of tables to extract has been determined by dynamically profiling the `mpgtrial` database. Full findings are documented in `docs/mpgtrial_data_profile.md`.)*

## 3. Data Cleansing & Transformation Rules
*   **Architecture (ELT):** Data extraction handles pure raw syncing using `dlt` (Python) to a `raw_evaluationau` schema in Postgres. `dbt` (SQL) is then responsible for transforming the raw tables into the final unified schema.
*   **Referential Integrity:** Enforced and tested during the `dbt` transformation phase. Orphans can be detected via dbt tests.
*   **Custom Fields:** `dbt` SQL will map `UserField` columns into structured `JSONB` native Postgres columns.
