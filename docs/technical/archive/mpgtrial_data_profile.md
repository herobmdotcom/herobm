# mpgtrial Data Profile & Analysis

This document catalogs the populated tables in the `mpgtrial` ABM database as of our initial Phase 1 analysis. It serves as the baseline for determining the exact ETL extraction scope.

## High-Volume Transactional Tables
*   `TRANSDETAILS` (633,690 rows) - **~161 writes/day**
*   `PBINTRACKING` (274,259 rows) - **~71 writes/day**
*   `TRANSHEADERS` (244,505 rows) - **~62 writes/day**
*   `PSALES` (81,523 rows) - *(Historical/Aggregated Data)*
*   `ZPURCHASE_INVOICES` (77,283 rows) - *(Historical/Aggregated Data)*
*   `TRANSOFFSETS` (55,524 rows) - **~14 writes/day**
*   `ZSALES_INVOICES` (43,973 rows) - *(Historical/Aggregated Data)*

## Master Data Tables (Targeted for Extraction)
*   **Products:** `PRODUCTS` (14,896 rows, **~4 writes/day**), `PRODUCTKITS` (3,461 rows)
*   **Trading Partners:** `SUPPLIERS` (54 rows), `CUSTOMERS` (17 rows), `CONTACTS` (14 rows), `CDELADDRESSES` (32 rows)

## In-Flight Operational Tables (Targeted for Extraction)
*   **Open Operations:** `ZSALES_ORDERS` (22,628 rows), `ZPURCHASE_ORDERS` (8,461 rows), `ZSALES_QUOTES` (1,887 rows)
*   **Stock & Bins:** `PLOCDETAILS` (19,023 rows), `PBINCONTENTS` (5,052 rows), `PBINS` (4,730 rows), `PLOCATIONS` (2 rows, **~0.04 writes/day**)
*   **Pricing:** `gProductAverages` (75,022 rows), `PSUPPLIERS` (9,301 rows, **~1.3 writes/day**), `gPriceList` (232 rows)

## Excluded Financial Tables (Deferred to ERPNext)
As per the requirement to exclude direct financial/customer balances from the Custom App:
*   `LBALANCES` (43,487 rows)
*   `TRANSCURADJ` (27,605 rows)
*   `ZCUSTOMER_RECEIPTS` (20,088 rows)
*   `ZSUPPLIER_REMITTANCES` (11,390 rows)
*   `gAgedCustomerTrans` (1,885 rows)
*   `gAgedSupplierTrans` (222 rows)
*   `BANKSTATEMENTS` (285 rows)
*   `LEDGER` (106 rows)
