---
id: cash-flow
title: "Statement of Cash Flows"
description: "Inspect direct operational, investing, and financing cash flows, verify zero-drift general ledger parity, and generate formal cash flow statements."
category: "Finance"
order: 24
resource: "finance"
action: "read"
routes:
  - "/general-ledger/cash-flow"
tags: ["finance", "general-ledger", "gl", "cash-flow", "liquidity", "reconciliation", "cash-parity", "accounting", "financial-reporting"]
fields:
  beginning_cash:
    title: "Beginning Cash"
    summary: "Total cash and cash equivalents balance at the start of the period."
  operating_cash_flow:
    title: "Operating Cash Flow"
    summary: "Net cash generated or consumed by core business operations (customer collections minus supplier, payroll, and tax payments)."
  investing_cash_flow:
    title: "Investing Cash Flow"
    summary: "Cash flows associated with the purchase and disposal of capital equipment, property, plant, and long-term investments."
  financing_cash_flow:
    title: "Financing Cash Flow"
    summary: "Cash movements related to equity funding, loan borrowings, debt principal repayments, and dividend distributions."
  ending_cash:
    title: "Ending Cash Balance"
    summary: "Calculated closing cash balance at the end of the period."
  gl_cash_balance:
    title: "GL Bank & Cash Balance"
    summary: "The actual general ledger control balance across all active bank and cash accounts."
  reconciliation_drift:
    title: "Reconciliation Drift"
    summary: "Difference between calculated net activity cash movements and GL bank account changes. Must equal 0.00."
related:
  - "general_ledger"
  - "fiscal_periods"
  - "balances"
  - "reconciliations"
---

# Statement of Cash Flows

The **Statement of Cash Flows** (`/general-ledger/cash-flow`) provides a direct, mathematically reconciled view of how cash moves through HeroBM over any selected fiscal period or custom date range.

While the Income Statement (P&L) tracks revenue and expenses on an **accrual basis**, the Statement of Cash Flows tracks actual **liquidity movements** (cash in and cash out of bank accounts).

---

## Direct Method Decomposition & Dual-Verification Engine

HeroBM implements a **Direct Activity Classification** engine paired with an **Independent Control Account Proof Engine**:

```mermaid
flowchart TD
    subgraph GL["General Ledger Journal Entries"]
        JE["herobm_core.gl_journal_entries & gl_journal_lines"]
    end

    subgraph DirectDecomp["1. Direct Activity Decomposition"]
        DetectCash["1. Detect Bank/Cash Accounts via is_bank_account = true"]
        ExcludeXfer["2. Inter-Bank Transfers Net Out to Zero"]
        Counterpart["3. Resolve Non-Cash Counterpart Lines (AR, AP, Capex, Debt, Equity)"]
        Buckets["4. Allocate to Operating, Investing, and Financing"]
    end

    subgraph ProofEngine["2. Control Account Proof Engine"]
        BegBal["Opening Cash = Sum(Debit - Credit) before Start Date"]
        EndBal["Closing Cash = Sum(Debit - Credit) through End Date"]
        ExpectedDelta["Expected Delta = Closing Cash - Opening Cash"]
    end

    subgraph ParityCheck["3. Mathematical Parity Proof"]
        CalcDelta["Calculated Delta = Net Operating + Net Investing + Net Financing"]
        Drift["Drift = Calculated Delta - Expected Delta"]
        Verdict{"|Drift| < $0.05?"}
        Reconciled["Verified: General Ledger Cash Parity Verified"]
        Unreconciled["Alert: Cash Reconciliation Drift Detected"]
    end

    JE --> DetectCash --> ExcludeXfer --> Counterpart --> Buckets --> CalcDelta
    JE --> BegBal & EndBal --> ExpectedDelta
    CalcDelta & ExpectedDelta --> Drift --> Verdict
    Verdict -- Yes --> Reconciled
    Verdict -- No --> Unreconciled
```

---

## Financial Classification Rules

### 1. Operating Activities
Cash flows directly related to running the business and delivering products:
* **Cash Receipts from Customers & Sales**: Payments received from customers against sales invoices (`party_type = 'customer'`, `default_ar_account_id`, revenue accounts).
* **Cash Paid to Suppliers & Inventory**: Disbursements to vendors for raw materials, inventory, and operating expenses (`party_type = 'supplier'`, `default_ap_account_id`, COGS, inventory assets).
* **Cash Paid to Employees & Payroll**: Wage and salary payments, superannuation, and payroll liabilities.
* **Income Tax & GST/VAT Payments (Net)**: Net tax remittances and input credit refunds (`default_sales_tax_account_id`, `default_purchase_tax_account_id`, GST/VAT clearing accounts).
* **Interest & Finance Charges Paid**: Bank service charges and borrowing interest.

### 2. Investing Activities
Capital investments in long-term operational infrastructure:
* **Purchase of Property, Plant & Equipment (Capex)**: Cash outflows for machinery, vehicles, tooling, and facility improvements.
* **Proceeds from Sale of Fixed Assets**: Cash inflows from selling or disposing of capital assets.

### 3. Financing Activities
Capital structure and debt financing transactions:
* **Proceeds from Issuance of Share Capital**: Equity injections and owner contributions.
* **Proceeds from Borrowings & Facilities**: Loan drawdowns and credit facility receipts.
* **Repayment of Borrowings & Leases**: Principal payments reducing loan and lease liabilities.
* **Dividends & Capital Distributions Paid**: Cash returns distributed to shareholders.

---

## Universal & Multi-Standard Compatibility

HeroBM is engineered to work universally across regional and international accounting standards:
* **Schema-Native Bank Account Identification**: Identifies bank and cash accounts using the `gl_accounts.is_bank_account = true` flag rather than relying on brittle account numbering prefixes.
* **International Standards Support**: Works out-of-the-box with **Anglo-Saxon/US GAAP** (4-digit numbering), **French PCG / OHADA** (Class 5 Bank, Class 4 AR/AP, Class 2 Capex), **German DATEV SKR03/SKR04** (`1200`/`1800` Bank, `0400`/`0600` Fixed Assets), and custom enterprise alphanumeric account codes (`BANK-USD-01`).
* **Inter-Bank Transfer Neutrality**: Moving funds between internal bank accounts (e.g. Operating to Savings) is recognized as an internal liquidity transfer and netted out to zero so operating cash flows remain undistorted.

---

## Step-by-Step Workflows

### 1. Reviewing the Statement of Cash Flows
1. Navigate to **Finance** → **General Ledger** → **Cash Flow** (`/general-ledger/cash-flow`).
2. Select your reporting view:
   * **Fiscal Period**: Select an accounting period (e.g. `2026-08 (hard closed)`).
   * **Custom Date Range**: Pick arbitrary Start and End dates.
3. Check the **Parity Verification Banner**:
   * A green banner confirms that calculated operational flows exactly match ledger bank account movements.
4. Review the KPI cards and four detailed schedules for Operating, Investing, Financing, and the Cash Reconciliation Schedule.

### 2. Exporting Statement PDFs
1. On the Cash Flow page, click **Statement PDF**.
2. The report service formats the statement using the official Typst report engine (`cash-flow-statement.typ`), embedding:
   * Company name, tax registration number, and address.
   * Full breakdown of all four financial schedules in the base currency.
   * Formal verification and sign-off block for controller, CFO, and auditor review.
   * Cryptographic SHA-256 snapshot hash ensuring document integrity.
3. The generated PDF opens in a new tab for saving, printing, or distribution to board members and auditors.
