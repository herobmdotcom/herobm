---
id: balances
title: "Balances & Aging"
description: "Review Accounts Receivable and Payable aging, customer statement balances, and tax liabilities."
category: "Finance"
order: 24
resource: "finance"
action: "read"
routes:
  - "/balances/customers"
  - "/balances/suppliers"
  - "/balances/tax"
tags: ["balances", "aging", "ar", "ap", "statements", "tax", "finance"]
fields:
  current_balance:
    title: "Current Balance"
    summary: "Invoices within standard trading terms (not overdue)."
  aging_30_days:
    title: "1–30 Days Overdue"
    summary: "Invoices overdue by up to 30 days."
  aging_60_days:
    title: "31–60 Days Overdue"
    summary: "Invoices overdue by 31 to 60 days."
  aging_90_plus:
    title: "90+ Days Overdue"
    summary: "Seriously delinquent invoices requiring immediate collection."
related:
  - "customers"
  - "suppliers"
  - "payments"
  - "general-ledger"
---

# Customer, Supplier & Tax Balances

The **Balances** module provides debtor and creditor aging reports, allowing credit controllers and finance teams to track cash flow, overdue balances, and net tax liabilities.

---

## Aging Buckets & Tax Summaries

```mermaid
flowchart LR
    A[Total Ledger Balance] --> B[Current < 30 Days]
    A --> C[30-60 Days Overdue]
    A --> D[60-90 Days Overdue]
    A --> E[90+ Days Overdue]
```

### 1. Customer Aging (Accounts Receivable)
Breaks down all unpaid customer invoices into standard 30-day buckets based on invoice due dates. Helps credit teams identify delinquent accounts before issuing new orders.

### 2. Supplier Aging (Accounts Payable)
Displays upcoming payment commitments owed to vendors, helping finance plan weekly cash disbursements.

### 3. Tax Balances
Summarizes output tax (GST/VAT collected on sales) against input tax (GST/VAT paid on purchases) to calculate the net tax payment or refund due for the period.

---

## Step-by-Step Workflows

### 1. Generating a Customer Statement
1. Go to **Finance** → **Balances** → **Customers** (`/balances/customers`).
2. Search for the customer name.
3. Review their aging breakdown and total outstanding exposure.
4. Click **Export Statement PDF** or **Email Statement** to send a formal statement of account to the debtor.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Total Balance** | Total unpaid ledger balance. |
| **Current** | Within agreed payment terms. |
| **30 / 60 / 90+ Days** | Overdue aging buckets. |
| **Net Tax Position** | Output Tax minus Input Tax. |
