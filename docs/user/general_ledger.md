---
id: general-ledger
title: "General Ledger & Chart of Accounts"
description: "Manage financial accounts, create manual journal entries, and generate the Trial Balance."
category: "Finance"
order: 23
resource: "finance"
action: "read"
routes:
  - "/general-ledger"
  - "/general-ledger/trial-balance"
  - "/general-ledger/journal-entries"
tags: ["finance", "general-ledger", "gl", "chart-of-accounts", "journal-entries", "trial-balance", "accounting"]
fields:
  account_code:
    title: "Account Code"
    summary: "Unique numerical GL code (e.g. 1000 Bank, 4000 Sales, 5000 COGS)."
  account_type:
    title: "Account Classification"
    summary: "Standard accounting class: Asset, Liability, Equity, Revenue, or Expense."
  journal_entry_number:
    title: "Journal Entry Number"
    summary: "Unique transaction identifier (e.g. JRN-2026-00041)."
  debit_amount:
    title: "Debit (DR)"
    summary: "Left-side transaction value."
  credit_amount:
    title: "Credit (CR)"
    summary: "Right-side transaction value."
related:
  - "balances"
  - "payments"
  - "reconciliations"
---

# General Ledger & Chart of Accounts

The **General Ledger (GL)** is the financial backbone of HeroBM. It records all automated postings from operations and allows accountants to enter manual adjusting journals and generate Trial Balances.

---

## Double-Entry Accounting Invariants

Every posted transaction in the system must obey the double-entry equation:

$$\sum \text{Debits} = \sum \text{Credits}$$

### Standard Automatic Postings

| Operational Event | Debit Account | Credit Account |
| :--- | :--- | :--- |
| **Sales Invoice** | Accounts Receivable | Sales Revenue + Tax Payable |
| **Supplier Invoice** | Inventory / Expense + Input Tax | Accounts Payable |
| **Customer Payment** | Bank Account | Accounts Receivable |
| **Supplier Payment** | Accounts Payable | Bank Account |
| **Stock Loss Adjustment** | Inventory Variance Expense | Inventory Asset |

---

## Step-by-Step Workflows

### 1. Creating a Manual Journal Entry
1. Go to **Finance** → **General Ledger** → **Journal Entries** (`/general-ledger/journal-entries`).
2. Click **New Journal Entry**.
3. Enter the **Transaction Date** and a clear **Description / Reference**.
4. Add line items: select GL accounts and enter Debit and Credit amounts.
5. Verify that total debits exactly equal total credits.
6. Click **Post Journal Entry**.

### 2. Viewing the Trial Balance
1. Go to **Finance** → **General Ledger** → **Trial Balance** (`/general-ledger/trial-balance`).
2. Select the financial period or date range.
3. Review debit/credit balances across all active accounts.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Account Code** | Numerical GL identifier. |
| **Account Name** | Description (e.g. Operating Bank Account). |
| **Account Type** | `Asset`, `Liability`, `Equity`, `Revenue`, or `Expense`. |
| **Debit / Credit** | Transaction amounts (must balance). |
| **Period** | Active financial month/year. |
