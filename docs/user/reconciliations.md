---
id: reconciliations
title: "Bank Reconciliations"
description: "Import bank statements, match bank feed lines against ledger payments, and resolve discrepancies."
category: "Finance"
order: 26
resource: "finance"
action: "read"
routes:
  - "/reconciliations"
  - "/reconciliations/profiles"
  - "/reconciliations/rules"
tags: ["reconciliations", "bank", "statements", "matching", "finance", "rules"]
fields:
  statement_date:
    title: "Statement Date"
    summary: "Closing date of the bank statement."
  gl_account_id:
    title: "Bank Account"
    summary: "GL bank account being reconciled."
  statement_balance:
    title: "Statement Ending Balance"
    summary: "Actual closing balance shown on the bank statement."
  ledger_balance:
    title: "GL Ledger Balance"
    summary: "Calculated balance from all posted General Ledger transactions (computed dynamically in the UI)."
  difference:
    title: "Variance / Difference"
    summary: "Unreconciled difference (must equal 0.00 to complete reconciliation, computed dynamically in the UI)."
related:
  - "payments"
  - "general-ledger"
  - "balances"
---

# Bank Reconciliations

The **Bank Reconciliations** module matches external bank feed transactions against internal General Ledger entries, verifying that financial accounts accurately reflect cash reality.

---

## Reconciliation Matching Rules

```mermaid
flowchart TD
    A[Import Bank Statement CSV / Feed] --> B[Automated Matching Rules Engine]
    B -- Exact Match --> C[Auto-Reconcile Transaction]
    B -- Rule Match --> D[Auto-Create Bank Fee / Interest Entry]
    B -- No Match --> E[Manual Match / Create Payment]
    C --> F{Difference == 0.00?}
    D --> F
    E --> F
    F -- Yes --> G[Sign Off & Lock Reconciliation]
    F -- No --> H[Review Unmatched Items]
```

### 1. Automated Matching Rules
Configurable rules (`/reconciliations/rules`) can automatically detect:
- Regular direct debits (e.g. utilities, rent).
- Bank service fees and interest.
- Customer deposits containing invoice reference numbers.

---

## Step-by-Step Workflows

### 1. Reconciling a Bank Statement
1. Go to **Finance** → **Bank Rec'n** → **Statements** (`/reconciliations`).
2. Click **Import Statement** and upload the bank CSV/OFX file.
3. Review the side-by-side matching screen:
   - Left side: Bank statement lines.
   - Right side: Unmatched GL payments and receipts.
4. Click **Auto-Match** to resolve identical amounts and references.
5. For remaining unmatched lines, select corresponding ledger entries or click **Create Entry** for ad-hoc bank charges.
6. Verify that the **Difference is 0.00**.
7. Click **Sign Off Reconciliation**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Bank Account** | Reconciled bank account. |
| **Statement Balance** | Official bank ending balance. |
| **Ledger Balance** | HeroBM General Ledger balance (computed dynamically). |
| **Variance** | Unreconciled difference (target 0.00, computed dynamically). |
