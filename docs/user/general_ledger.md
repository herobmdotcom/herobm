---
id: general-ledger
title: "General Ledger & Chart of Accounts"
description: "Manage financial accounts, create manual journal entries, monitor fiscal locking, and generate balanced Trial Balances."
category: "Finance"
order: 23
resource: "finance"
action: "read"
routes:
  - "/general-ledger"
  - "/general-ledger/trial-balance"
  - "/general-ledger/journal-entries"
  - "/general-ledger/journal-entries/new"
tags: ["finance", "general-ledger", "gl", "chart-of-accounts", "journal-entries", "trial-balance", "accounting", "fiscal-periods"]
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
  - "fiscal-periods"
  - "balances"
  - "payments"
  - "reconciliations"
---

# General Ledger & Chart of Accounts

The **General Ledger (GL)** is the financial backbone of HeroBM. It records all automated postings from operations, supports manual adjusting journal entries, enforces fiscal period lock boundaries, and validates Trial Balance mathematical integrity.

---

## Double-Entry Accounting Invariants

Every posted transaction in the system must obey the double-entry equation:

**Total Debits = Total Credits**

### Standard Automatic Postings

| Operational Event | Debit Account | Credit Account |
| :--- | :--- | :--- |
| **Sales Invoice** | Accounts Receivable | Sales Revenue + Tax Payable |
| **Supplier Invoice** | Inventory / Expense + Input Tax | Accounts Payable |
| **Customer Payment** | Bank Account | Accounts Receivable |
| **Supplier Payment** | Accounts Payable | Bank Account |
| **Purchase Debit Note** | Accounts Payable | Inventory / Expense + Input Tax |
| **Stock Loss Adjustment** | Inventory Variance Expense | Inventory Asset |

---

## Fiscal Locking & Balance Integrity

### 1. Fiscal Period Enforcement
- All manual journal entries and automated operational postings check the active [Fiscal Period](file:///docs/user/fiscal_periods.md).
- Postings with effective dates falling into a **Hard Closed** period are blocked.
- Postings in a **Soft Locked** period require explicit user confirmation.

### 2. Trial Balance Zero-Sum Check
The Trial Balance report incorporates continuous zero-sum verification:

**Total Debits - Total Credits = 0.00**

If any rounding imbalance exceeds `±0.005`, the system highlights an out-of-balance anomaly and prevents closing the period.

### 3. Subledger Parity Verification
Automated subledger reconciliation checks reconcile:
- **Accounts Receivable** control account vs **Customer Aged Balances**.
- **Accounts Payable** control account vs **Supplier Aged Balances**.
- **Inventory Asset** control account vs **Inventory Valuation Ledger**.

---

## Step-by-Step Workflows

### 1. Creating a Manual Journal Entry
1. Go to **Finance** → **General Ledger** → **Journal Entries** (`/general-ledger/journal-entries`).
2. Click **New Journal Entry** (`/general-ledger/journal-entries/new`).
3. Enter the **Transaction Date** and a clear **Description / Reference**.
4. Add line items: select GL accounts and enter Debit and Credit amounts.
5. Verify that total debits exactly equal total credits (**Total Debits = Total Credits**).
6. Click **Post Journal Entry**.

### 2. Viewing the Trial Balance
1. Go to **Finance** → **General Ledger** → **Trial Balance** (`/general-ledger/trial-balance`).
2. Select the financial period or date range.
3. Review debit/credit balances across all active accounts.
4. Verify the zero-sum balanced status banner at the top of the report.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Account Code** | Numerical GL identifier. |
| **Account Name** | Description (e.g. Operating Bank Account). |
| **Account Type** | `Asset`, `Liability`, `Equity`, `Revenue`, or `Expense`. |
| **Debit / Credit** | Transaction amounts (must balance). |
| **Period** | Active financial month/year. |
| **Zero-Sum Variance** | Variance indicator ensuring debits equal credits. |
