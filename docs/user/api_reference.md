---
id: api-reference
title: "REST API Reference"
description: "RESTful API documentation, authentication, rate limits, error schemas, and endpoint catalog."
category: "Technical"
order: 33
resource: "system"
action: "read"
routes:
  - "/admin/developers"
tags: ["api", "rest", "swagger", "openapi", "endpoints", "developers", "integration"]
---

# REST API Reference

The HeroBM REST API provides programmatic access to master data, operational documents (Sales Orders, Invoices, Shipments, Purchase Orders), and financial ledgers.

---

## Authentication & Headers

All API requests (except public health checks) require a valid **API Key** or **Bearer JWT Token** in the `Authorization` HTTP header:

```http
Authorization: Bearer YOUR_API_KEY
Content-Type: application/json
Accept: application/json
```

### Generating API Keys
1. Go to **Technical** → **Developers** (`/admin/developers`).
2. In the **API Keys** section, click **+ Add Key**.
3. Select an assigned role (e.g. `agent`, `viewer`, or `admin`).
4. Copy the generated secret key.

---

## Interactive Swagger Documentation

An interactive OpenAPI / Swagger UI test workbench is available on the running API server:
- **Interactive Documentation**: [`/api/docs`](/api/docs)
- **OpenAPI 3.0 JSON Specification**: [`/docs/developers/openapi.json`](/api/docs-json)

---

## Rate Limits & Error Handling

- **Rate Limits**: By default, requests are limited to **1,000 requests per minute** per API key (configurable in Developer Settings).
- **HTTP Status Codes**:
  - `200 OK` / `201 Created`: Request succeeded.
  - `400 Bad Request`: Malformed request body or schema validation error.
  - `401 Unauthorized`: Missing or invalid API key.
  - `403 Forbidden`: Insufficient role permissions for the requested resource.
  - `404 Not Found`: Entity or endpoint not found.
  - `429 Too Many Requests`: Rate limit exceeded.

---

## Core Endpoint Catalog (463 Endpoints Across 24 Domains)

### Actors

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/actors` | Create Actor |
| `GET` | `/actors` | Get all Actors (paginated) |
| `GET` | `/actors/{id}` | Get Actor by ID |
| `PATCH` | `/actors/{id}` | Update Actor |
| `DELETE` | `/actors/{id}` | Delete Actor |
| `PATCH` | `/actors/{id}/contacts/{contactId}` | Update Contact Link on Actor |
| `DELETE` | `/actors/{id}/contacts/{contactId}` | Remove Contact Link from Actor |
| `POST` | `/actors/{id}/contacts` | Link Contact to Actor |
| `POST` | `/actors/{id}/archive` | Archive Actor |
| `POST` | `/actors/{id}/unarchive` | Unarchive Actor |
| `POST` | `/actors/{id}/notes` | Add Note to Actor |
| `DELETE` | `/actors/{id}/notes/{noteId}` | Remove Note from Actor |

### CRM Map

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/crm-map` | Get CRM Graph Map Data |

### Contacts

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/contacts` | List Contacts |
| `POST` | `/contacts` | Create Contact |
| `GET` | `/contacts/{id}` | Get Contact |
| `PATCH` | `/contacts/{id}` | Update Contact |
| `DELETE` | `/contacts/{id}` | Delete Contact |
| `POST` | `/contacts/{id}/archive` | Archive Contact |
| `POST` | `/contacts/{id}/unarchive` | Unarchive Contact |

### Customers

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/customers` | List Customers |
| `POST` | `/customers` | Create Customer |
| `GET` | `/customers/aged-balances` | Get Aged Balances |
| `GET` | `/customers/{id}` | Get Customer |
| `PATCH` | `/customers/{id}` | Update Customer |
| `GET` | `/customers/{id}/credit-assessment` | Get Credit Assessment |
| `POST` | `/customers/{id}/archive` | Archive Customer |
| `POST` | `/customers/{id}/unarchive` | Unarchive Customer |
| `POST` | `/customers/{id}/email-document` | Email Customer Statement Document |
| `GET` | `/customer-groups` | List Customer Groups |
| `POST` | `/customer-groups` | Create Customer Group |
| `GET` | `/customer-groups/{id}` | Get Customer Group |
| `PATCH` | `/customer-groups/{id}` | Update Customer Group |
| `DELETE` | `/customer-groups/{id}` | Delete Customer Group |

### Delivery Addresses

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/delivery-addresses` | Create a new delivery address |
| `PUT` | `/delivery-addresses/{id}` | Update an existing delivery address |
| `DELETE` | `/delivery-addresses/{id}` | Delete a delivery address |

### General Ledger

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/settings/exchange-rates` | findAll |
| `POST` | `/settings/exchange-rates` | create |
| `GET` | `/settings/exchange-rates/{id}` | findOne |
| `PATCH` | `/settings/exchange-rates/{id}` | update |
| `DELETE` | `/settings/exchange-rates/{id}` | remove |
| `GET` | `/settings/cost-centers` | List all cost centers |
| `POST` | `/settings/cost-centers` | Create a new cost center |
| `PATCH` | `/settings/cost-centers/{id}` | Update a cost center |
| `DELETE` | `/settings/cost-centers/{id}` | Delete a cost center |
| `POST` | `/settings/cost-centers/import` | Bulk import cost centers |
| `GET` | `/gl/accounts` | Get Accounts |
| `POST` | `/gl/accounts` | Create Account |
| `PATCH` | `/gl/accounts/{id}` | Update Account |
| `GET` | `/gl/journal-entries` | Get Journal Entries |
| `POST` | `/gl/journal-entries` | Create Manual Entry |
| `GET` | `/gl/journal-entries/{id}` | Get Journal Entry |
| `GET` | `/gl/journal-entries/source/{type}/{id}` | Get Source Entry |
| `GET` | `/gl/trial-balance` | Get Trial Balance |
| `GET` | `/gl/general-ledger` | Get General Ledger |
| `GET` | `/gl/settings` | Get Settings |
| `PATCH` | `/gl/settings` | Update Settings |
| `GET` | `/gl/fx-revaluation/candidates` | Get FX Revaluation Candidates |
| `POST` | `/gl/fx-revaluation/commit` | Commit Period-End FX Revaluation |
| `POST` | `/gl/settings/reload` | Reload Settings |
| `GET` | `/gl/charts` | List Charts |
| `POST` | `/gl/seed` | Seed Chart of Accounts |
| `GET` | `/gl/tax-settings-files` | List Tax Settings |
| `POST` | `/gl/seed-tax` | Seed Tax Settings |
| `GET` | `/gl/periods` | Get Fiscal Periods |
| `POST` | `/gl/periods/generate` | Generate Fiscal Periods |
| `PATCH` | `/gl/periods/{id}/status` | Update Fiscal Period Status |
| `GET` | `/gl/reconciliation/subledger` | Get Continuous Subledger Reconciliation |
| `GET` | `/gl/reconciliations` | Get Reconciliations |
| `POST` | `/gl/reconciliations` | Create Reconciliation |
| `GET` | `/gl/reconciliations/{id}` | Get Reconciliation |
| `DELETE` | `/gl/reconciliations/{id}` | Discard Reconciliation |
| `GET` | `/gl/reconciliations/{id}/unreconciled` | Get Unreconciled Lines |
| `POST` | `/gl/reconciliations/{id}/lines/{lineId}/toggle` | Toggle Line Status |
| `POST` | `/gl/reconciliations/{id}/post` | Post Reconciliation |
| `POST` | `/gl/reconciliations/{id}/adjustments` | Create Adjustment |
| `POST` | `/gl/bank-feeds/parse` | Parse CSV |
| `POST` | `/gl/bank-feeds/import` | Import CSV |
| `GET` | `/gl/bank-feeds/profiles` | Get Mapping Profiles |
| `POST` | `/gl/bank-feeds/profiles` | Create Mapping Profile |
| `PUT` | `/gl/bank-feeds/profiles/{profileId}` | Update Mapping Profile |
| `DELETE` | `/gl/bank-feeds/profiles/{profileId}` | Delete Mapping Profile |
| `GET` | `/gl/bank-feeds/rules` | Get Rules |
| `POST` | `/gl/bank-feeds/rules` | Create Rule |
| `PUT` | `/gl/bank-feeds/rules/{ruleId}` | Update Rule |
| `DELETE` | `/gl/bank-feeds/rules/{ruleId}` | Delete Rule |
| `GET` | `/gl/bank-statement/lines` | Get bank statement lines |
| `POST` | `/gl/bank-statement/lines/{id}/confirm-match` | Confirm a smart match |
| `POST` | `/gl/bank-statement/lines/{id}/manual-match` | Manually match a line |
| `POST` | `/gl/bank-statement/lines/bulk` | Create bank statement lines in bulk |
| `POST` | `/gl/bank-statement/match-bulk` | Bulk match bank statement lines and journal lines |
| `POST` | `/gl/bank-statement/auto-match` | Auto match bank statement lines |
| `POST` | `/gl/bank-statement/unmatch` | Unmatch items |
| `DELETE` | `/gl/bank-statement/lines/{id}` | Delete bank statement line |
| `GET` | `/gl/bank-statement/match-group/{matchGroupId}` | Get match group |

### Global Notes

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/global-notes` | Find All Global Notes |

### Help

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/help/context` | Get contextual help for the active screen route |
| `GET` | `/help/topics` | Get all accessible documentation topics |
| `GET` | `/help/topics/{id}` | Get full topic content by ID |
| `GET` | `/help/search` | Search documentation topics |

### Manufacturing / Work Orders

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/manufacturing/work-orders` | List Work Orders |
| `POST` | `/manufacturing/work-orders` | Create Work Order |
| `GET` | `/manufacturing/work-orders/{id}` | Get Work Order by ID |
| `PATCH` | `/manufacturing/work-orders/{id}` | Update Work Order |
| `PATCH` | `/manufacturing/work-orders/{id}/components/{componentId}` | Update Work Order Component |
| `POST` | `/manufacturing/work-orders/{id}/release` | Release Work Order |
| `POST` | `/manufacturing/work-orders/{id}/complete` | Complete Work Order Production |
| `POST` | `/manufacturing/work-orders/{id}/cancel` | Cancel Work Order |
| `GET` | `/manufacturing/work-orders/{id}/picking` | Get Work Order Picking Summary |
| `POST` | `/manufacturing/work-orders/{id}/picking/lines/{lineId}` | Pick Work Order Component |
| `DELETE` | `/manufacturing/work-orders/{id}/picking/picks/{pickId}` | Cancel Component Pick |

### Payments

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/payments` | Find All Payments |
| `POST` | `/payments` | Create Payment |
| `GET` | `/payments/run-candidates` | Get Payment Run Candidates |
| `POST` | `/payments/generate-run` | Generate Payment Run |
| `GET` | `/payments/{id}` | Find Payment |
| `DELETE` | `/payments/{id}` | Remove Draft Payment |
| `PATCH` | `/payments/{id}/submit` | Submit Payment |
| `PATCH` | `/payments/{id}/allocate` | Allocate Payment |
| `PATCH` | `/payments/{id}/cancel` | Cancel Payment |
| `POST` | `/payments/export-aba` | Export ABA |
| `POST` | `/payments/export-nacha` | Export NACHA |
| `POST` | `/payments/confirm-exported` | Confirm Exported Payments |
| `POST` | `/payments/reject-exported` | Reject Exported Payments |
| `POST` | `/payments/{id}/email-document` | Email Payment Document / Remittance Advice |

### Products

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/products/images/{path}` | Stream Product Image |
| `GET` | `/products` | List Products |
| `POST` | `/products` | Create Product |
| `GET` | `/products/{id}` | Get Product |
| `PATCH` | `/products/{id}` | Update Product |
| `POST` | `/products/{id}/archive` | Archive Product |
| `POST` | `/products/{id}/unarchive` | Unarchive Product |
| `POST` | `/products/{id}/suppliers` | Add Product Supplier |
| `DELETE` | `/products/{id}/suppliers/{vendorId}` | Remove Product Supplier |
| `POST` | `/products/{id}/uoms` | Add Product UOM |
| `DELETE` | `/products/{id}/uoms/{uomId}` | Remove Product UOM |
| `POST` | `/products/{id}/default-bins` | Link Default Bin |
| `DELETE` | `/products/{id}/default-bins/{binLinkId}` | Remove Default Bin |
| `GET` | `/products/{id}/components` | List Components |
| `POST` | `/products/{id}/components` | Add Component |
| `PATCH` | `/products/{id}/components/{componentId}` | Update Component |
| `DELETE` | `/products/{id}/components/{componentId}` | Remove Component |
| `POST` | `/products/{id}/image` | Upload Product Image |
| `DELETE` | `/products/{id}/image` | Remove Product Image |
| `GET` | `/product-groups` | List Product Groups |
| `POST` | `/product-groups` | Create Product Group |
| `GET` | `/product-groups/{id}` | Get Product Group |
| `PATCH` | `/product-groups/{id}` | Update Product Group |
| `DELETE` | `/product-groups/{id}` | Delete Product Group |

### Projects

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/projects` | Create Project |
| `GET` | `/projects` | Get all Projects |
| `GET` | `/projects/{id}` | Get Project by ID |
| `PATCH` | `/projects/{id}` | Update Project |
| `DELETE` | `/projects/{id}` | Delete Project |
| `POST` | `/projects/{id}/archive` | Archive Project |
| `POST` | `/projects/{id}/unarchive` | Unarchive Project |
| `POST` | `/projects/{id}/notes` | Add Note to Project |
| `DELETE` | `/projects/{id}/notes/{noteId}` | Delete Note from Project |
| `POST` | `/projects/{id}/contacts` | Add Contact to Project |
| `DELETE` | `/projects/{id}/contacts/{contactId}` | Remove Contact from Project |
| `PATCH` | `/projects/{id}/contacts/{contactId}` | Update Contact Role on Project |
| `POST` | `/projects/{id}/actors` | Add Actor to Project |
| `PUT` | `/projects/{id}/actors/{actorId}` | Update Actor Role on Project |
| `DELETE` | `/projects/{id}/actors/{actorId}` | Remove Actor from Project |

### Purchase Invoices

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/purchase-orders/{id}/invoices` | Get Purchase Bills |
| `GET` | `/purchase-debit-notes` | Find Debit Notes |
| `POST` | `/purchase-debit-notes` | Create Debit Note |
| `GET` | `/purchase-debit-notes/{id}` | Get Debit Note |
| `POST` | `/purchase-debit-notes/{id}/post` | Post Debit Note |
| `POST` | `/purchase-debit-notes/{id}/email-document` | Email Purchase Debit Note Document |

### Purchase Orders

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/purchase-orders` | Create Purchase Order |
| `GET` | `/purchase-orders` | List Purchase Orders |
| `GET` | `/purchase-orders/pending-lines` | List Pending Lines |
| `GET` | `/purchase-orders/returnable-lines` | List Returnable Lines |
| `PATCH` | `/purchase-orders/{id}/state` | Change Order State |
| `POST` | `/purchase-orders/{id}/archive` | Archive Purchase Order |
| `POST` | `/purchase-orders/{id}/unarchive` | Unarchive Purchase Order |
| `POST` | `/purchase-orders/{id}/lines` | Add Order Line |
| `PATCH` | `/purchase-orders/{id}/lines/{lineId}` | Update Order Line |
| `DELETE` | `/purchase-orders/{id}/lines/{lineId}` | Remove Order Line |
| `GET` | `/purchase-orders/{id}` | Get Purchase Order |
| `PATCH` | `/purchase-orders/{id}` | Update Purchase Order |
| `POST` | `/purchase-orders/{id}/email-document` | Email Purchase Order Document |

### Purchase Returns

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/purchase-orders/{id}/returns` | Create Purchase Return |
| `GET` | `/purchase-orders/{id}/returns` | List Purchase Returns |
| `GET` | `/purchase-orders/{id}/returns/{returnId}` | Get Purchase Return |
| `POST` | `/purchase-orders/{id}/returns/{returnId}/stage` | Stage Purchase Return |
| `POST` | `/purchase-orders/{id}/returns/{returnId}/unstage` | Unstage Purchase Return |
| `POST` | `/purchase-orders/{id}/returns/{returnId}/ship` | Ship Purchase Return |
| `POST` | `/purchase-orders/{id}/returns/{returnId}/unship` | Unship Purchase Return |
| `POST` | `/purchase-orders/{id}/returns/{returnId}/cancel` | Cancel Purchase Return |
| `GET` | `/purchase-returns` | List Purchase Returns |
| `GET` | `/purchase-returns/{id}` | Get Purchase Return |
| `POST` | `/purchase-returns/{id}/mark-resolved` | Mark Purchase Return as Resolved |
| `POST` | `/purchase-returns/{id}/email-document` | Email Purchase Return Document |

### Sales Invoices

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/sales-orders/{id}/invoice` | Create Sales Invoice |
| `GET` | `/sales-orders/{id}/invoices` | Get Sales Invoices |
| `GET` | `/sales-invoices/{id}` | Get Sales Invoice Details |
| `PATCH` | `/sales-invoices/{id}/state` | Change Sales Invoice State |
| `POST` | `/sales-invoices/{id}/admin-mark-paid` | Mark Sales Invoice as Paid (Admin) |
| `GET` | `/sales-invoices` | Get All Sales Invoices |
| `GET` | `/purchase-invoices` | Get All Purchase Invoices |
| `POST` | `/purchase-invoices` | Create Draft Invoice |
| `GET` | `/purchase-invoices/{id}` | Get Purchase Invoice Details |
| `PATCH` | `/purchase-invoices/{id}` | Update Invoice |
| `POST` | `/purchase-invoices/{id}/admin-mark-paid` | Mark Purchase Invoice as Paid (Admin) |
| `POST` | `/purchase-invoices/{id}/post` | Post Invoice |
| `PATCH` | `/purchase-invoices/{id}/state` | Change Invoice State |
| `PATCH` | `/purchase-invoices/{id}/lines/{lineId}` | Update Invoice Line |
| `DELETE` | `/purchase-invoices/{id}/lines/{lineId}` | Remove Invoice Line |
| `POST` | `/purchase-invoices/{id}/lines` | Add Invoice Line |
| `POST` | `/purchase-invoices/lines/{lineId}/resolve` | Resolve Invoice Line |
| `POST` | `/purchase-invoices/lines/{lineId}/unresolve` | Unresolve Invoice Line |
| `POST` | `/purchase-invoices/{id}/auto-match` | Auto-Match Purchase Order |

### Sales Orders

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/sales-orders` | Find All Orders |
| `POST` | `/sales-orders` | Create Order |
| `POST` | `/sales-orders/{id}/tax` | Calculate Taxes |
| `POST` | `/sales-orders/{id}/email-document` | Email Document |
| `PATCH` | `/sales-orders/{id}/state` | Change Order State |
| `POST` | `/sales-orders/{id}/override-credit-hold` | Override Credit Hold |
| `POST` | `/sales-orders/{id}/archive` | Archive Order |
| `POST` | `/sales-orders/{id}/unarchive` | Unarchive Order |
| `POST` | `/sales-orders/{id}/lines` | Add Order Line |
| `PATCH` | `/sales-orders/{id}/lines/{lineId}` | Update Order Line |
| `DELETE` | `/sales-orders/{id}/lines/{lineId}` | Remove Order Line |
| `POST` | `/sales-orders/{id}/post-confirmation-lines` | Add Post-Confirmation Line |
| `GET` | `/sales-orders/{id}` | Find Order |
| `PATCH` | `/sales-orders/{id}` | Update Order |

### Sales Returns

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/sales-orders/{id}/returns` | Create Return |
| `GET` | `/sales-orders/{id}/returns` | Find Order Returns |
| `GET` | `/sales-orders/{id}/returns/{returnId}` | Find Return |
| `PATCH` | `/sales-orders/{id}/returns/{returnId}` | Update Return |
| `PATCH` | `/sales-orders/{id}/returns/{returnId}/state` | Change Return State |
| `POST` | `/sales-orders/{id}/returns/{returnId}/lines` | Add Return Line |
| `PATCH` | `/sales-orders/{id}/returns/{returnId}/lines/{lineId}` | Update Return Line |
| `DELETE` | `/sales-orders/{id}/returns/{returnId}/lines/{lineId}` | Remove Return Line |
| `POST` | `/sales-orders/{id}/returns/{returnId}/receive` | Receive Return |
| `GET` | `/sales-returns` | Find Global Returns |
| `GET` | `/sales-returns/{id}` | Find Return by ID |
| `GET` | `/sales-credit-notes` | Find Credit Notes |
| `POST` | `/sales-credit-notes` | Create Credit Note |
| `GET` | `/sales-credit-notes/{id}` | Get Credit Note |
| `POST` | `/sales-credit-notes/{id}/post` | Post Credit Note |

### Suppliers

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/suppliers` | List Suppliers |
| `POST` | `/suppliers` | Create Supplier |
| `GET` | `/suppliers/aged-balances` | Get Aged Balances |
| `GET` | `/suppliers/by-product/{productId}` | List Product Suppliers |
| `GET` | `/suppliers/{id}` | Get Supplier |
| `PATCH` | `/suppliers/{id}` | Update Supplier |
| `GET` | `/suppliers/{id}/products` | List Supplier Products |
| `POST` | `/suppliers/{id}/archive` | Archive Supplier |
| `POST` | `/suppliers/{id}/unarchive` | Unarchive Supplier |
| `GET` | `/suppliers/{id}/expiries` | List Expiries |
| `POST` | `/suppliers/{id}/expiries` | Create Expiry |
| `PATCH` | `/suppliers/{id}/expiries/{expiryId}` | Update Expiry |
| `DELETE` | `/suppliers/{id}/expiries/{expiryId}` | Delete Expiry |
| `GET` | `/supplier-groups` | List Supplier Groups |
| `POST` | `/supplier-groups` | Create Supplier Group |
| `GET` | `/supplier-groups/{id}` | Get Supplier Group |
| `PATCH` | `/supplier-groups/{id}` | Update Supplier Group |
| `DELETE` | `/supplier-groups/{id}` | Delete Supplier Group |

### System

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/login` | Login User |
| `GET` | `/auth/me` | Get Current User |
| `GET` | `/roles` | Find all roles |
| `GET` | `/roles/{role}` | Get role details |
| `POST` | `/roles/{role}` | Set role permissions |
| `DELETE` | `/roles/{role}` | Delete role |
| `POST` | `/pdf-templates/hooks/{hookSlug}/run` | Run Hook |
| `GET` | `/pdf-templates/hooks` | Get Hooks |
| `GET` | `/pdf-templates/hook-assignments` | Get Hook Assignments |
| `PATCH` | `/pdf-templates/hook-assignments/{hook}` | Update Hook Assignment |
| `GET` | `/pdf-templates/hooks/{slug}/random-id` | Get Random ID |
| `GET` | `/pdf-templates` | Get All Reports |
| `POST` | `/pdf-templates` | Create Report |
| `GET` | `/pdf-templates/{id}` | Get Report |
| `PATCH` | `/pdf-templates/{id}` | Update Report |
| `DELETE` | `/pdf-templates/{id}` | Delete Report |
| `POST` | `/pdf-templates/preview` | Preview Report |
| `GET` | `/emails` | List emails |
| `POST` | `/emails/{id}/retry` | Retry a failed email |
| `POST` | `/emails/{id}/dismiss` | Dismiss a failed email |
| `GET` | `/emails/test-connection` | test-connection |
| `GET` | `/settings/uom-dictionary` | findAll |
| `POST` | `/settings/uom-dictionary` | create |
| `GET` | `/settings/uom-dictionary/{code}` | findOne |
| `PATCH` | `/settings/uom-dictionary/{code}` | update |
| `DELETE` | `/settings/uom-dictionary/{code}` | remove |
| `GET` | `/settings/organization` | get |
| `PATCH` | `/settings/organization` | update |
| `GET` | `/settings/app` | get |
| `PATCH` | `/settings/app` | update |
| `GET` | `/settings/trading-terms` | List trading terms |
| `POST` | `/settings/trading-terms` | Create trading term |
| `PATCH` | `/settings/trading-terms/{id}` | Update trading term |
| `DELETE` | `/settings/trading-terms/{id}` | Delete trading term |
| `GET` | `/settings/activities` | List all activities |
| `POST` | `/settings/activities` | Create a new activity |
| `PATCH` | `/settings/activities/{id}` | Update an activity |
| `DELETE` | `/settings/activities/{id}` | Delete an activity |
| `POST` | `/settings/activities/import` | Bulk import activities |
| `GET` | `/settings/license-status` | Get License Status |
| `POST` | `/settings/license` | Apply License |
| `GET` | `/business-reports` | List available business reports |
| `POST` | `/business-reports` | Create a business report |
| `GET` | `/business-reports/hooks` | List available data source hooks |
| `POST` | `/business-reports/{slug}/data` | Fetch data for a business report |
| `GET` | `/business-reports/{id}` | Get a business report by ID |
| `PUT` | `/business-reports/{id}` | Update a business report |
| `DELETE` | `/business-reports/{id}` | Delete a business report |
| `GET` | `/settings/external-sync` | Get Sync Status |
| `GET` | `/settings/external-sync/events` | Get Events By Type |
| `DELETE` | `/settings/external-sync/events` | Clear Events By Type |
| `GET` | `/enrichment/lookup` | Lookup data |
| `POST` | `/enrichment/lookup` | Lookup data (POST) |
| `GET` | `/enrichment/test` | Test provider |
| `POST` | `/enrichment/test` | Test provider (POST) |
| `GET` | `/enrichment/providers` | Get providers |
| `GET` | `/enrichment/config` | Get config |
| `PUT` | `/enrichment/config` | Update config |
| `GET` | `/dashboard/summary` | Get Summary |
| `GET` | `/dashboard/search` | Universal Search |
| `GET` | `/dashboard/timeline` | Get Timeline |
| `POST` | `/telemetry/client-errors` | Report Client Error |
| `GET` | `/health` | System Healthcheck |
| `GET` | `/data-sources` | List all registered data sources |
| `GET` | `/data-sources/{slug}/sample-report` | Get sample data for Business Reports (fetchData format) |
| `GET` | `/data-sources/{slug}/sample-record` | Get sample data for PDF Templates (resolveData format) |
| `GET` | `/admin/system-logs` | Get System Logs |
| `GET` | `/admin/version` | Get System Version |
| `POST` | `/setup/test-abm` | Test ABM Connection |
| `POST` | `/setup/test-odoo` | Test Odoo Connection |
| `GET` | `/setup/resume-state` | Get Resume State |
| `GET` | `/setup/resume-state-odoo` | Get Odoo Resume State |
| `POST` | `/setup/execute-elt` | Execute ELT Job |
| `GET` | `/setup/active-job` | Get Active Job |
| `DELETE` | `/setup/active-job/{jobId}` | Stop Active Job |
| `GET` | `/setup/progress/{jobId}` | Get Job Progress |
| `GET` | `/setup/validation` | Get Validation State |
| `GET` | `/setup/import-summary` | Get Import Summary |
| `GET` | `/setup/csv-metadata` | Get CSV Metadata |
| `POST` | `/setup/execute-csv` | Execute CSV Import |
| `POST` | `/macros` | Create Macro |
| `GET` | `/macros` | List Macros |
| `GET` | `/macros/{id}` | Get Macro |
| `PATCH` | `/macros/{id}` | Update Macro |
| `DELETE` | `/macros/{id}` | Delete Macro |
| `GET` | `/users` | List Users |
| `POST` | `/users` | Create User |
| `GET` | `/users/{id}` | Get User |
| `PATCH` | `/users/{id}` | Update User |
| `DELETE` | `/users/{id}` | Delete User |
| `PATCH` | `/users/{id}/toggle-active` | Toggle User Status |
| `GET` | `/discount-matrix` | List Rules |
| `POST` | `/discount-matrix` | Create Rule |
| `GET` | `/discount-matrix/resolve` | Resolve Rules |
| `PATCH` | `/discount-matrix/{id}` | Update Rule |
| `DELETE` | `/discount-matrix/{id}` | Delete Rule |
| `GET` | `/webhooks` | List Webhooks |
| `POST` | `/webhooks` | Create Webhook |
| `GET` | `/webhooks/events` | List Available Events |
| `PUT` | `/webhooks/{id}` | Update Webhook |
| `DELETE` | `/webhooks/{id}` | Delete Webhook |
| `GET` | `/api-keys` | List API Keys |
| `POST` | `/api-keys` | Create API Key |
| `DELETE` | `/api-keys/{id}` | Revoke API Key |
| `POST` | `/events/publish` | Publish Event |
| `GET` | `/user-settings` | Get user settings |
| `PATCH` | `/user-settings` | Update user settings |

### Tax

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/tax-categories` | List Tax Categories |
| `POST` | `/tax-categories` | Create Tax Category |
| `GET` | `/tax-categories/{id}` | Get Tax Category |
| `PATCH` | `/tax-categories/{id}` | Update Tax Category |
| `DELETE` | `/tax-categories/{id}` | Delete Tax Category |
| `GET` | `/tax-positions/mappings` | List all tax position mappings (ignores path param for now) |
| `POST` | `/tax-positions/{taxPositionId}/mappings` | Create a new mapping for a tax position |
| `DELETE` | `/tax-positions/{taxPositionId}/mappings/{sourceTaxCategoryId}` | Remove a mapping from a tax position |
| `GET` | `/tax-positions` | List all tax positions |
| `POST` | `/tax-positions` | Create a new tax position |
| `GET` | `/tax-positions/{id}` | Get a tax position by id |
| `PUT` | `/tax-positions/{id}` | Update a tax position |
| `DELETE` | `/tax-positions/{id}` | Delete a tax position |
| `GET` | `/tax/bas-summary` | Get ATO BAS Summary Report Data |

### Transfer Orders

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/transfers/from-demands` | Create From Demands |
| `GET` | `/transfers/{id}/events` | Find Events |
| `GET` | `/transfers/{id}/picking` | Get Picking Summary |
| `POST` | `/transfers/{id}/picking/lines/{lineId}` | Pick Transfer Line |
| `DELETE` | `/transfers/{id}/picking/picks/{pickId}` | Cancel Transfer Pick |
| `POST` | `/transfers/{id}/ship` | Ship Transfer Order |
| `POST` | `/transfers/{id}/receive` | Receive Transfer Order |
| `POST` | `/transfers/{id}/cancel` | Cancel Transfer Order |
| `POST` | `/transfers/{id}/cancel-shipment` | Cancel Transfer Order Shipment |
| `GET` | `/transfers` | Find All Transfers |
| `POST` | `/transfers` | Create Transfer Order |
| `GET` | `/transfers/{id}` | Find Transfer |
| `PATCH` | `/transfers/{id}` | Update Transfer Order |
| `GET` | `/transfers/{id}/shipments` | Find Shipments |
| `POST` | `/transfers/{id}/lines` | Add Transfer Line |
| `PATCH` | `/transfers/{id}/lines/{lineId}` | Update Transfer Line |
| `DELETE` | `/transfers/{id}/lines/{lineId}` | Remove Transfer Line |

### Unified Returns

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/global-returns` | Find Global Returns (Sales and Purchase) |

### Warehouse

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/inventory` | List Inventory |
| `GET` | `/inventory/by-products` | Get By Products |
| `POST` | `/inventory/by-products-bulk` | Bulk Get By Products |
| `GET` | `/inventory/bins` | List Inventory Bins |
| `POST` | `/inventory/bins` | Create Bin |
| `GET` | `/inventory/putaway-context` | Get Putaway Context |
| `GET` | `/inventory/locations` | List Locations |
| `POST` | `/inventory/locations` | Create Location |
| `GET` | `/inventory/locations/{id}/bins` | Get Location Bins |
| `GET` | `/inventory/topography` | Get Warehouse Topography |
| `GET` | `/inventory/ledger` | List Ledger Entries |
| `GET` | `/inventory/entries/{id}` | Get Entry Details |
| `GET` | `/inventory/pending-putaway` | List Pending Putaways |
| `POST` | `/inventory/putaway` | Process Putaways |
| `POST` | `/inventory/quarantine/move` | Move to/from Quarantine |
| `POST` | `/inventory/move` | Move Stock manually |
| `POST` | `/inventory/adjust` | Adjust Stock manually |
| `GET` | `/sales-orders/picking-queue` | Get Picking Queue |
| `GET` | `/sales-orders/{id}/picking` | Get Picking Summary |
| `GET` | `/sales-orders/{id}/picking/barcodes` | Get Picking Barcodes |
| `POST` | `/sales-orders/{id}/picking/lines/{lineId}` | Pick Order Line |
| `DELETE` | `/sales-orders/{id}/picking/picks/{pickId}` | Cancel Pick |
| `GET` | `/sales-orders/shipping-queue` | Get Shipping Queue |
| `GET` | `/sales-orders/{id}/shipping-context` | Get Shipping Context |
| `POST` | `/sales-orders/{id}/shipments` | Create Shipment |
| `GET` | `/sales-orders/{id}/shipments` | Find Order Shipments |
| `GET` | `/sales-orders/{id}/shipments/{shipmentId}` | Find Shipment |
| `PATCH` | `/sales-orders/{id}/shipments/{shipmentId}` | Update Shipment |
| `PATCH` | `/sales-orders/{id}/shipments/{shipmentId}/state` | Change Shipment State |
| `POST` | `/sales-orders/{id}/shipments/{shipmentId}/cancel` | Cancel Shipment |
| `POST` | `/sales-orders/{id}/shipments/{shipmentId}/lines` | Add Shipment Line |
| `PATCH` | `/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}` | Update Shipment Line |
| `DELETE` | `/sales-orders/{id}/shipments/{shipmentId}/lines/{lineId}` | Remove Shipment Line |
| `GET` | `/shipments` | Find All Shipments |
| `GET` | `/shipments/{id}` | Find Shipment |
| `POST` | `/shipments/{id}/email-document` | Email Shipment Document |
| `GET` | `/allocations/open` | Get Open Demands |
| `GET` | `/allocations/by-po/{poId}` | Get PO Allocations |
| `GET` | `/allocations/available-po-lines` | Get Available PO Lines |
| `POST` | `/allocations/link-po` | Link Demand To PO |
| `POST` | `/allocations/resolve` | Resolve Open Demands |
| `POST` | `/allocations/{id}/unlink` | Unlink Demand |
| `POST` | `/allocations/{id}/reallocate` | Reallocate Demand |
| `POST` | `/allocations/generate-pos` | Generate POs |
| `POST` | `/allocations/generate-transfers` | Generate Transfers |
| `GET` | `/inventory/locations/{id}` | Get Location |
| `PATCH` | `/inventory/locations/{id}` | Update Location |
| `DELETE` | `/inventory/locations/{id}` | Delete Location |
| `POST` | `/inventory/zones` | Create Zone |
| `PATCH` | `/inventory/zones/{id}` | Update Zone |
| `DELETE` | `/inventory/zones/{id}` | Delete Zone |
| `POST` | `/inventory/bins/bulk` | Create Bins in Bulk |
| `PATCH` | `/inventory/bins/{id}` | Update Bin |
| `DELETE` | `/inventory/bins/{id}` | Delete Bin |
| `POST` | `/goods-received` | Create Goods Receipt |
| `GET` | `/goods-received` | List Goods Receipts |
| `GET` | `/goods-received/lines` | List Received Lines |
| `GET` | `/goods-received/{id}` | Get Goods Receipt |
| `PATCH` | `/goods-received/{id}` | Update Goods Receipt |
| `POST` | `/goods-received/{id}/cancel` | Cancel Goods Receipt |
| `POST` | `/goods-received/lines/{lineId}/resolve` | Resolve Allocation |
| `POST` | `/goods-received/lines/{lineId}/unresolve` | Unresolve Allocation |

