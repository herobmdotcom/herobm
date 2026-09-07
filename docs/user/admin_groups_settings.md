---
id: admin-settings
title: "Groups & System Settings"
description: "Configure product groups, customer and supplier groups, analysis codes, payment terms, tax codes, currency exchange, email outbox, and print templates."
category: "Administration"
order: 28
resource: "admin"
action: "read"
routes:
  - "/admin/customer-groups"
  - "/admin/product-groups"
  - "/admin/supplier-groups"
  - "/admin/settings/financial"
  - "/admin/settings/pdf-templates"
  - "/admin/settings/pdf-templates/new"
  - "/admin/settings/pdf-hooks"
  - "/admin/settings/crm"
  - "/admin/settings/integrations"
  - "/admin/settings/license"
  - "/admin/settings/system"
  - "/admin/email/settings"
  - "/admin/email/outbox"
tags: ["admin", "settings", "groups", "financial", "email", "pdf", "templates", "analysis-codes", "tax"]
fields:
  customer_groups:
    title: "Customer Groups"
    summary: "Commercial classifications assigning default price scales (1–4), default AR control accounts, and trading terms."
  supplier_groups:
    title: "Supplier Groups"
    summary: "Procurement categories setting default AP accounts, payment terms, and spend analytics tags."
  product_groups:
    title: "Product Groups"
    summary: "Merchandise hierarchies defining default Sales Revenue accounts, COGS accounts, and inventory asset accounts."
  analysis_codes:
    title: "Analysis Codes"
    summary: "Multi-dimensional reporting tags attached to orders, invoices, and journal lines for granular financial analysis."
  financial_settings:
    title: "Financial Settings"
    summary: "Core ledger controls including base currency, default tax positions, AR/AP control accounts, and fiscal calendar parameters."
related:
  - "admin-users"
  - "technical-operations"
  - "general-ledger"
  - "dynamic-reporting"
---

# Groups & System Settings

The **Groups & System Settings** module provides centralized configuration across commercial pricing structures, accounting control accounts, automated email delivery, and Typst PDF printing templates.

---

## Configuration Areas

### 1. Group Management & Analysis Codes
* **Customer Groups** (`/admin/customer-groups`): Segment clients by trade type (e.g. Retail, Wholesale, Key Accounts) and assign default Price Scales (1 to 4) and Accounts Receivable control accounts.
* **Supplier Groups** (`/admin/supplier-groups`): Categorize vendors (e.g. Domestic Freight, Raw Material Vendors, Overseas Mills) and assign default Accounts Payable accounts.
* **Product Groups** (`/admin/product-groups`): Hierarchical catalogue classifications defining default Sales Income, Cost of Goods Sold (COGS), and Inventory Asset accounts.
* **Analysis Codes** (`/admin/settings/system#sales-analysis-codes-section`): Configurable multidimensional reporting codes applied to operational transactions for segmental reporting.
* **Trading Terms**: Standard credit terms (Net 30, Net 60, COD, Prepayment) determining due dates on invoices and purchase orders.

### 2. Financial Settings (`/admin/settings/financial`)
* **Base Currency & Multi-Currency**: Sets the primary operating currency and exchange rate revaluation parameters.
* **Control Accounts**: Default AR, AP, GRNI Clearing, Inventory Asset, and Tax clearing accounts.
* **Chart of Accounts Import**: Upload and deploy standard ERPNext JSON Chart of Accounts definitions.
* **FX Revaluation**: Period-end unrealized exchange rate adjustments are executed via the API (`POST /api/gl/fx-revaluation/commit`).

### 3. Email Outbox & SMTP Settings
* **Email Settings** (`/admin/email/settings`): Configure outbound SMTP servers (Host, Port, TLS, Username, Password, From Address).
* **Email Outbox** (`/admin/email/outbox`): Queue tracking all sent and pending emails with automated exponential retry.

### 4. PDF Document Templates & Hooks
* **PDF Templates** (`/admin/settings/pdf-templates`): Customize modern Typst layouts for Sales Orders, Quotes, Invoices, Pick Slips, Delivery Dockets, and Debit Notes.
* **PDF Hooks** (`/admin/settings/pdf-hooks`): Connect system event triggers to specific PDF template renderings.

### 5. CRM Pipeline & Opportunity Settings (`/admin/settings/crm`)
* **Pipeline Stages (`projectStatuses`)**: Define ordered stages representing the sales journey (e.g. Discovery, Proposal, Negotiation, Won, Lost) that populate the CRM Opportunities Kanban board.
* **Opportunity Types (`projectTypes`)**: Configure classification categories for deals (e.g. New Business, Renewal, Expansion, Consulting).

---

## Step-by-Step Workflows

### 1. Creating a Customer Group with a Price Scale
1. Go to **Administration** → **Settings** → **Groups** (`/admin/settings/groups`).
2. In the **Customer Groups** section, click **New Group**.
3. Enter the **Group Name** and select the default **Price Scale (1–4)**.
4. Select the default **AR Control Account** and **Trading Terms**.
5. Click **Save Group**.

### 2. Configuring Outbound SMTP Email
1. Go to **Administration** → **Email** → **Settings** (`/admin/email/settings`).
2. Enter your SMTP Host, Port, and authentication credentials.
3. Send a test email to verify server connectivity.
4. Click **Save Settings**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Customer Group** | Segment determining price scale and default AR account. |
| **Supplier Group** | Procurement category setting default AP account. |
| **Product Group** | Inventory category setting revenue and COGS accounts. |
| **Trading Terms** | Due date calculation rule (e.g. `Net 30`). |
| **Analysis Codes** | Financial tags for multidimensional reporting. |
| **Pipeline Stages** | Configurable stages for sales opportunities in the CRM Kanban board. |

