---
id: admin-settings
title: "Master Groups & System Settings"
description: "Configure customer/supplier/product groups, company profile, default financial accounts, and global settings."
category: "Administration"
order: 28
resource: "settings"
action: "read"
routes:
  - "/admin/customer-groups"
  - "/admin/supplier-groups"
  - "/admin/product-groups"
  - "/admin/settings/system"
  - "/admin/settings/financial"
  - "/admin/settings/crm"
  - "/admin/settings/integrations"
  - "/admin/settings/license"
  - "/admin/settings/pdf-hooks"
  - "/admin/settings/pdf-templates"
tags: ["admin", "settings", "groups", "financial-settings", "system", "pdf-hooks", "license"]
fields:
  company_name:
    title: "Company Legal Name"
    summary: "Registered business name appearing on legal documents and tax invoices."
  base_currency:
    title: "Base Currency"
    summary: "Global operating currency (EUR) for financial ledger consolidation."
  financial_year_start:
    title: "Financial Year Start"
    summary: "Starting month for fiscal year reporting."
  default_accounts:
    title: "Default GL Accounts"
    summary: "System accounts for AR, AP, Inventory Asset, Revenue, and Tax Payable."
related:
  - "admin-users"
  - "general-ledger"
  - "technical-operations"
---

# Master Groups & System Settings

The **Administration: Settings** section configures classification groups, company profile details, default General Ledger accounts, and global application options.

---

## Group Configurations & Settings Sections

```mermaid
flowchart TD
    S[System Administration] --> G[Master Groups<br/>Customer, Supplier, Product Groups]
    S --> C[Company Profile & License]
    S --> F[Financial & Tax Settings]
    S --> P[PDF Hooks & Document Layouts]
```

### 1. Customer, Supplier & Product Groups
- **Customer Groups**: Set group-level price scales (1–4), default trading terms, and percentage discounts.
- **Supplier Groups**: Categorize vendors for spend reporting and default expense accounts.
- **Product Groups**: Group items for inventory accounting, margin analysis, and catalog navigation.

### 2. Financial & System Settings
- **Financial Settings** (`/admin/settings/financial`): Configure standard chart of account linkages (Accounts Receivable, Accounts Payable, Sales Tax Liability, Rounding, Retained Earnings).
- **System Settings** (`/admin/settings/system`): Manage global defaults, timezones, and number sequence generators for orders, quotes, and invoices.

---

## Step-by-Step Workflows

### 1. Creating a Customer Group
1. Go to **Admin** → **Groups** → **Customer Groups** (`/admin/customer-groups`).
2. Click **New Customer Group**.
3. Enter the **Group Name** (e.g. Wholesale Tier 2).
4. Select the default **Price Scale** (e.g. Scale 3) and **Group Discount %**.
5. Select the default **Payment Terms** (e.g. Net 30).
6. Click **Save Group**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Company Profile** | Legal name, tax registration number, logo, and address. |
| **Price Scale** | Default pricing tier (1–4) assigned to customer groups. |
| **Default AR/AP Accounts** | Control accounts in General Ledger for automated postings. |
| **System Numbering** | Prefixes and next sequence numbers for invoices and orders. |
