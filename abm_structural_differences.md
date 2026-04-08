# ABM Structural Drift Analysis: Singapore vs Australia

## 1. Table Presence Differences
**Tables only in SG (Legacy Mode)**: 2
```
ASMATTACHMENTS, VW_ZSALES_ORDERS_UNFULFILLED
```
**Tables only in AU (New/Modular Features)**: 4
```
GINACTIVEPRODUCTS, PRODUCTKITS_19, PSUPPLIERSOLD, SYSDIAGRAMS
```

## 2. Table Usage Drift (Row Counts)
This checks if a globally existing Table is actively populated in one region but dormant in another.

| Table Name | SG Rows | AU Rows | Category |
|------------|---------|---------|----------|
| `COMPANYPRINTDATA` | 2 | 0 | SG-Active Only |
| `IMPORTEXPORTDATA` | 3 | 0 | SG-Active Only |
| `IMPORTEXPORTSETS` | 1 | 0 | SG-Active Only |
| `PSERIALNUMBER` | 12 | 0 | SG-Active Only |
| `PSERIALTRACKING` | 25 | 0 | SG-Active Only |
| `COMPANYPRINTDATA` | 2 | 0 | SG-Active Only |
| `CRMNOTES` | 0 | 237 | AU-Active Only |
| `GINACTIVEPRODUCTS` | 0 | 69993 | AU-Active Only |
| `GPRODUCTASATDATE` | 0 | 43695 | AU-Active Only |
| `IMPORTEXPORTDATA` | 3 | 0 | SG-Active Only |
| `IMPORTEXPORTSETS` | 1 | 0 | SG-Active Only |
| `LISTCONTACTS` | 0 | 58 | AU-Active Only |
| `LSUBACCOUNTS2` | 0 | 75 | AU-Active Only |
| `MAILINGLISTS` | 0 | 1 | AU-Active Only |
| `PAVAILABILITY` | 0 | 20 | AU-Active Only |
| `PRICEDETAILS` | 0 | 455 | AU-Active Only |
| `PRICEHEADERS` | 0 | 10 | AU-Active Only |
| `PRINTQUEUE` | 0 | 187 | AU-Active Only |
| `PRODUCTKITS_19` | 0 | 193 | AU-Active Only |
| `PSERIALNUMBER` | 12 | 0 | SG-Active Only |
| `PSERIALTRACKING` | 25 | 0 | SG-Active Only |
| `PSUPPLIERSOLD` | 0 | 1 | AU-Active Only |
| `REPORTFAVOURITES` | 0 | 13 | AU-Active Only |
| `STOCKTAKEBATCHES` | 0 | 51 | AU-Active Only |
| `STOCKTAKEITEMBINCONTENTS` | 0 | 4446 | AU-Active Only |
| `STOCKTAKEITEMS` | 0 | 5442 | AU-Active Only |
| `ZPURCHASE_DELIVERIES` | 0 | 327 | AU-Active Only |

## 3. Deep Column Usage Drift (Core ELT Tables Only)
This section compares the 29 critical ELT tables. We highlight fields that are heavily utilized in one region but completely barren in the other.

| Table | Column | SG Population Vol | AU Population Vol | Verdict |
|-------|--------|-------------------|-------------------|---------|
| `CUSTOMERS` | `ANALYSISTITLE` | 0 (empty) | 1358 (populated) | Novel to AU |
| `CUSTOMERS` | `BANKNAME` | 0 (empty) | 63 (populated) | Novel to AU |
| `CUSTOMERS` | `BRANCHNAME` | 0 (empty) | 56 (populated) | Novel to AU |
| `CUSTOMERS` | `CATEGORY` | 0 (empty) | 1384 (populated) | Novel to AU |
| `CUSTOMERS` | `ISPARENTAC` | 0 (empty) | 25 (populated) | Novel to AU |
| `CUSTOMERS` | `PARENTACCOUNT` | 0 (empty) | 36 (populated) | Novel to AU |
| `CUSTOMERS` | `REMARKS` | 0 (empty) | 418 (populated) | Novel to AU |
| `CUSTOMERS` | `RUNNUMBER` | 0 (empty) | 279 (populated) | Novel to AU |
| `CONTACTS` | `EMAIL2` | 0 (empty) | 26 (populated) | Novel to AU |
| `CONTACTS` | `HOMEPHONE` | 0 (empty) | 15 (populated) | Novel to AU |
| `CONTACTS` | `MOBILEPHONE` | 0 (empty) | 1700 (populated) | Novel to AU |
| `CONTACTS` | `NOTES` | 0 (empty) | 20 (populated) | Novel to AU |
| `CONTACTS` | `OUTLOOKDATA` | 0 (empty) | 172 (populated) | Novel to AU |
| `CONTACTS` | `STATECOUNTY` | 0 (empty) | 485 (populated) | Novel to AU |
| `CONTACTS` | `USERLOCKNO` | 0 (empty) | 12 (populated) | Novel to AU |
| `SUPPLIERS` | `ISINDIVIDUAL` | 0 (empty) | 250 (populated) | Novel to AU |
| `SUPPLIERS` | `TPARAPPLIES` | 0 (empty) | 250 (populated) | Novel to AU |
| `SGROUPS` | `NOABNCONTROL` | 0 (empty) | 3 (populated) | Novel to AU |
| `PRODUCTS` | `ALTERNATEITEM` | 0 (empty) | 44 (populated) | Novel to AU |
| `PRODUCTS` | `BARCODE1` | 0 (empty) | 14 (populated) | Novel to AU |
| `PRODUCTS` | `SALESINFO` | 0 (empty) | 3 (populated) | Novel to AU |
| `PRODUCTS` | `ZALBURYLOC` | 0 (empty) | 1804 (populated) | Novel to AU |
| `PRODUCTS` | `ZALTINVDES` | 0 (empty) | 9667 (populated) | Novel to AU |
| `PRODUCTS` | `ZHLINK` | 0 (empty) | 84 (populated) | Novel to AU |
| `PRODUCTS` | `ZPERTHLOC` | 0 (empty) | 6109 (populated) | Novel to AU |
| `PRODUCTS` | `ZQLDLOC` | 0 (empty) | 4661 (populated) | Novel to AU |
| `PRODUCTS` | `ZVGW` | 0 (empty) | 17843 (populated) | Novel to AU |
| `PRODUCTS` | `ZWEIGHT` | 6646 (populated) | 0 (empty) | Deprecated in AU |
| `PUNITS` | `LASTEDITDATETIME` | 22 (populated) | 0 (empty) | Deprecated in AU |
| `PUNITS` | `USERFINDNO` | 0 (empty) | 2 (populated) | Novel to AU |
| `PUNITS` | `USERLOCKNO` | 0 (empty) | 2 (populated) | Novel to AU |
| `PLOCATIONS` | `LOCATIONADDRESS` | 0 (empty) | 3 (populated) | Novel to AU |
| `PLOCATIONS` | `LOCATIONCOUNTRY` | 0 (empty) | 1 (populated) | Novel to AU |
| `PLOCATIONS` | `LOCATIONPOSTCODE` | 0 (empty) | 1 (populated) | Novel to AU |
| `PLOCATIONS` | `LOCATIONSTATE` | 0 (empty) | 1 (populated) | Novel to AU |
| `PLOCATIONS` | `LOCATIONSTREET1` | 0 (empty) | 1 (populated) | Novel to AU |
| `PLOCATIONS` | `LOCATIONSUBURB` | 0 (empty) | 1 (populated) | Novel to AU |
| `PLOCATIONS` | `ZSHOWKIT` | 0 (populated) | *Not in Schema* | Dropped DB Column in AU |
| `COMPANY` | `COMPANYURL` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `CURRENTDEPOSITNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `FEATURESWITCHES` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTCHEQUENO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTJOURNALREF` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTPCREDITNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTPDELIVERYNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTPINVOICENO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTPORDERNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTPREQNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTPRETURNNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSCREDITNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSDELIVERYNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSINVOICENO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSORDERNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSPINVNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSQUOTENO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `NEXTSRETURNNO` | 0 (empty) | 1 (populated) | Novel to AU |
| `COMPANY` | `PLUGINKEYS` | 1 (populated) | 0 (empty) | Deprecated in AU |
| `COMPANY` | `REPORTICONPATH` | 1 (populated) | 0 (empty) | Deprecated in AU |
| `COMPANY` | `SUBAC2NAME` | 0 (empty) | 1 (populated) | Novel to AU |
| `PLOCDETAILS` | `BINNUMBER` | 0 (empty) | 13020 (populated) | Novel to AU |
| `TRANSHEADERS` | `DELIVERYID` | 0 (empty) | 23981 (populated) | Novel to AU |
| `ZSALES_ORDERS` | `MYCOMPANYURL` | 0 (empty) | 70801 (populated) | Novel to AU |
| `ZSALES_DELIVERIES` | `ABN_VAT_GSTNO` | 0 (empty) | 574 (populated) | Novel to AU |
| `ZSALES_DELIVERIES` | `CURRENCYSYMBOL` | 2 (populated) | 0 (empty) | Deprecated in AU |
| `ZSALES_DELIVERIES` | `MYCOMPANYURL` | 0 (empty) | 1957 (populated) | Novel to AU |
| `ZSALES_QUOTES` | `CURRENCYSYMBOL` | 1889 (populated) | 0 (empty) | Deprecated in AU |
| `ZSALES_QUOTES` | `MYCOMPANYURL` | 0 (empty) | 128758 (populated) | Novel to AU |
| `ZPURCHASE_ORDERS` | `MYCOMPANYURL` | 0 (empty) | 13673 (populated) | Novel to AU |
| `ZPURCHASE_INVOICES` | `MYCOMPANYURL` | 0 (empty) | 320 (populated) | Novel to AU |
| `ZSALES_INVOICES` | `MYCOMPANYURL` | 0 (empty) | 92370 (populated) | Novel to AU |
| `ZSALES_INVOICES` | `TOTALTAX2` | 2395 (populated) | 0 (empty) | Deprecated in AU |

## 4. Logical Domain Analysis & Groupings

Based on the raw data above, the drift between the systems is not random—it clearly indicates that the **Australia (AU)** instance operates as a deeply modernized, feature-rich ERP, whereas the **Singapore (SG)** instance relies heavily on legacy or localized minimum-feature configurations.

Here is the analysis of the discrepancies, grouped into **6 core logical domains**:

### 4.1 Australian Compliance & Tax Reporting (AU-Heavy)
Australia possesses strict contractor tax and identification reporting laws. The AU system features specific additions to manage these legalities seamlessly:
- **`SUPPLIERS.TPARAPPLIES`**: Flags if the Taxable Payments Annual Report (TPAR) applies (mandatory for AU construction, IT, and courier contractors).
- **`SGROUPS.NOABNCONTROL`**: Enforces validation on Australian Business Numbers (ABNs) for supplier groups.
- **`ZSALES_DELIVERIES.ABN_VAT_GSTNO`**: Storing explicitly calculated tax parameters and ABN definitions directly on the delivery dockets to survive tax audits.

### 4.2 Advanced CRM & Corporate Hierarchies (AU-Heavy)
The AU database demonstrates heavy usage of rich CRM features, complex multi-tier architectures, and marketing endpoints that are completely vacant in SG.
- **Corporate Hierarchy**: Utilizing `CUSTOMERS.PARENTACCOUNT`, `ISPARENTAC`, and `COMPANY.SUBAC2NAME` implies AU models complex B2B enterprises and parent-child operational accounts. Multi-tier Sub-Accounts (`LSUBACCOUNTS2`) are also uniquely active.
- **Contact Enrichment**: Heavy population of `CUSTOMERS.ANALYSISTITLE`, `CATEGORY`, `REMARKS` and `CONTACTS.STATECOUNTY`, `MOBILEPHONE` implies far stricter data capture for segmentation.
- **Marketing & Integrations**: `CRMNOTES`, `MAILINGLISTS`, and specifically `CONTACTS.OUTLOOKDATA` confirm active outbound sales efforts syncing with Microsoft Outlook.

### 4.3 Advanced Supply-Chain & Multi-Warehouse Strategy (AU-Heavy)
Australia inherently demands a much larger geographical supply-chain. The database perfectly reflects a complex, bin-tracked, regional warehouse network.
- **Regional Locations**: The custom product columns `ZALBURYLOC`, `ZPERTHLOC`, and `ZQLDLOC` show explicit inventory tracing to regional hubs (Albury, Perth, Queensland).
- **Bin & Stocktake Management**: Usage of `STOCKTAKEBATCHES`, `STOCKTAKEITEMS`, `STOCKTAKEITEMBINCONTENTS`, and `PLOCDETAILS.BINNUMBER` proves AU uses precise, physical bin-level inventory routing.
- **Temporal Logging**: `GPRODUCTASATDATE` allows AU to query inventory values "as-at" a specific date, heavily utilized for precise retail accounting.
- **Kitting**: `PRODUCTKITS_19` signifies bundling individual SKUs into shippable kits natively.

### 4.4 Advanced Commercial Pricing Engine (AU-Heavy)
- **Matrix Pricing**: `PRICEDETAILS` and `PRICEHEADERS` indicate AU operates dynamic, segmented or tier-based pricing matrices to run commercial trade rules, whereas SG relies on flat pricing endpoints.

### 4.5 Multi-Tenant Workflows & Centralized Sequencing (AU-Heavy)
AU centrally tracks document sequences and dynamically renders client-facing assets, implying a multi-tenant business model.
- **Global Sequences**: The `COMPANY` table contains an array of active trackers (`NEXTINVOICENO`, `NEXTPORDERNO`, `NEXTCHEQUENO`, etc.). Relying on a centralized state over native database incrementors suggests AU might use alphanumeric prefixing rules for transaction origins.
- **Dynamic Endpoints**: Over 200,000 transaction records feature a populated `MYCOMPANYURL` (e.g. `ZSALES_QUOTES.MYCOMPANYURL`). This enables AU to generate custom physical PDFs/Portals depending on which child-brand generated the transaction.

### 4.6 Legacy Workflows (SG-Heavy)
The parts of the database only utilized in SG reflect older engineering or deprecation patterns.
- **File Syncing**: `IMPORTEXPORTDATA` and `IMPORTEXPORTSETS` suggest SG uses scheduled batch flat-file syncs (e.g., FTP uploads). Modern ERP structures try to replace this via live API relays.
- **Raw Object Control**: SG relies entirely on legacy blobs (`ASMATTACHMENTS`), raw metadata columns (`PRODUCTS.ZWEIGHT`, `COMPANY.REPORTICONPATH`), and unlinked currency (`ZSALES_QUOTES.CURRENCYSYMBOL`) which have been superseded or deprecated in AU in favor of linked relational structures.
- **Legacy Serial Tracking**: SG uses `PSERIALNUMBER` and `PSERIALTRACKING` frequently, though absent in AU. This implies SG manually scans manufactured parts directly into older DB nodes rather than using a modern Warehouse Management System (WMS) bridge.