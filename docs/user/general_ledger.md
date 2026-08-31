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
  - "/general-ledger/cash-flow"
  - "/general-ledger/journal-entries"
  - "/general-ledger/journal-entries/new"
tags: ["finance", "general-ledger", "gl", "chart-of-accounts", "journal-entries", "trial-balance", "cash-flow", "accounting", "fiscal-periods", "invariants"]
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
    summary: "Left-side transaction value increasing Assets/Expenses or decreasing Liabilities/Equity/Revenue."
  credit_amount:
    title: "Credit (CR)"
    summary: "Right-side transaction value increasing Liabilities/Equity/Revenue or decreasing Assets/Expenses."
related:
  - "cash-flow"
  - "fiscal-periods"
  - "balances"
  - "payments"
  - "reconciliations"
---

# General Ledger & Chart of Accounts

The **General Ledger (GL)** is the financial backbone of HeroBM. It records all automated postings from operations, supports manual adjusting journal entries, enforces fiscal period lock boundaries, and validates Trial Balance mathematical integrity.

---

## Chart of Accounts & ERPNext Format Import

HeroBM organizes all financial postings within a structured, hierarchical **Chart of Accounts (COA)** across five root classifications: `Asset`, `Liability`, `Equity`, `Revenue`, and `Expense`.

HeroBM natively supports importing Chart of Accounts structured in the **ERPNext JSON format**. When provisioning a new company or updating accounting structures:
- **Built-in Presets**: HeroBM includes ready-to-use regional presets such as Australia Standard (`au_standard.json`) and US Standard (`us_standard.json`).
- **ERPNext Verified Templates**: You can import or adapt any of the country-specific templates available in the official [ERPNext Verified Chart of Accounts repository](https://github.com/frappe/erpnext/tree/develop/erpnext/accounts/doctype/account/chart_of_accounts/verified).
- **Importing in the UI**: Navigate to **Administration** → **Settings** → **Financial Settings** (`/admin/settings/financial`), scroll to the **Chart of Accounts** section, and click **Import Preset** to load and apply a chart of accounts template.

---

## Double-Entry Accounting Invariants & Validation

### 1. The Zero-Sum Invariant Rule
Every journal transaction in HeroBM is verified before persistence:

```
Total Debits - Total Credits = 0.00 (Tolerance: |Balance| <= 0.005)
```

If debits and credits do not match within half a cent, the journal is rejected by the API.

### 2. Posting Account & Period Validation
Before an entry is committed:
1. **Posting Node Check**: Accounts must be active leaf nodes (transactions cannot post directly to abstract group header accounts).
2. **Fiscal Period Gate**: Transaction date must fall within an `Open` fiscal period. If the period is `Soft Locked`, an elevated confirmation is required; if `Hard Closed`, the posting is blocked.
3. **Control Account Protection**: System control accounts (Accounts Receivable, Accounts Payable, Inventory Asset, GRNI Clearing) are updated automatically by operational subledgers. Manual adjustments require explicit reconciliation notes.

### 3. Automated Postings Master Map

| Operational Event | Debit Leg(s) | Credit Leg(s) |
| :--- | :--- | :--- |
| **Customer Sales Invoice** | Accounts Receivable Control | Sales Revenue + Output Tax Payable |
| **Sales Order Dispatch (COGS)** | Cost of Goods Sold (COGS) | Inventory Asset Account (at WAC) |
| **Sales Credit Note** | Sales Revenue + Output Tax | Accounts Receivable Control |
| **Goods Receipt (GRN)** | Inventory Asset Account | Goods Received Not Invoiced (GRNI) Accrual |
| **Supplier Invoice Match** | GRNI Accrual + Input Tax (+ PPV/FX) | Accounts Payable Control (+ PPV/FX) |
| **Customer Payment Received** | Bank Account (+ Payment Gateway Fees) | Accounts Receivable Control |
| **Supplier Bill Payment** | Accounts Payable Control | Bank Account (+ Early Payment Discount) |
| **Inventory Scrap / Count Loss** | Inventory Shrinkage Expense | Inventory Asset Account |

### 4. Ledger Immutability & Compliance Auditing
- **Database-Level Immutability**: All posted journal entries (`gl_journal_entries`, `gl_journal_lines`) and payment allocations are permanently protected by PostgreSQL triggers (`herobm_core.prevent_financial_deletion`). Direct SQL or API `DELETE` actions are strictly rejected.
- **Scheduled Automated Integrity Audits**: A background BullMQ verification engine runs daily at 2:00 AM to verify:
  1. Monotonic sequential numbering without gaps across all subledgers.
  2. Timestamp continuity and absence of chronological inversions.
  3. 100% journal linkage between subledger operational transactions and General Ledger double-entry lines.
  4. Mathematical debit/credit balance equality (Total Debits = Total Credits).
- **Proactive Alerting**: If any anomaly is detected, the system immediately surfaces a **Dashboard Timeline Alert** (under the Finance group) and dispatches an **Admin Email Notification** for immediate remediation.

---

## Step-by-Step Workflows

### 1. Creating a Manual Journal Entry
1. Go to **Finance** → **General Ledger** → **Journal Entries** (`/general-ledger/journal-entries`).
2. Click **New Journal Entry** (`/general-ledger/journal-entries/new`).
3. Enter the **Transaction Date** and a clear **Description / Reference**.
4. Add line items: select leaf GL accounts and enter Debit and Credit amounts.
5. Verify that total debits equal total credits (`Zero-Sum Variance = 0.00`).
6. Click **Post Journal Entry**.

### 2. Viewing the Trial Balance
1. Go to **Finance** → **General Ledger** → **Trial Balance** (`/general-ledger/trial-balance`).
2. Select the financial period or custom date range.
3. Review debit/credit balances across all active accounts.
4. Verify the zero-sum balanced status banner at the top of the report.

### 3. Reviewing the Statement of Cash Flows
1. Go to **Finance** → **General Ledger** → **Cash Flow** (`/general-ledger/cash-flow`).
2. Select an active **Fiscal Period** or **Custom Date Range**.
3. Verify that the **Parity Verification Banner** is green (reconciled with zero drift).
4. Review direct operating, investing, and financing cash flow breakdowns.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Account Code** | Unique numerical GL identifier (e.g. `1000 Bank`). |
| **Account Name** | Descriptive label of the ledger account. |
| **Account Classification** | Root category (`Asset`, `Liability`, `Equity`, `Revenue`, `Expense`). |
| **Debit / Credit** | Double-entry transaction amounts (must balance to zero). |
| **Journal Entry Number** | Unique audit sequence identifier (e.g. `JRN-2026-00041`). |
| **Zero-Sum Variance** | Difference check ensuring debits equal credits (`<= 0.005`). |

