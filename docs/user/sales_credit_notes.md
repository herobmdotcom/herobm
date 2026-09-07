---
id: sales-credit-notes
title: "Sales Credit Notes"
description: "Issue customer credit notes for returns, billing corrections, or goodwill, post GL reversals, and allocate credits to open invoices."
category: "Sales"
order: 9
resource: "sales-credit-notes"
action: "read"
routes:
  - "/sales-credit-notes"
  - "/sales-credit-notes/:id"
tags: ["credit-notes", "sales", "ar", "refunds", "returns", "reversals", "allocations", "email", "pdf"]
fields:
  credit_note_number:
    title: "Credit Note Number"
    summary: "Unique legal credit adjustment identifier (e.g. CRN-2026-00034)."
  customer_id:
    title: "Customer Account"
    summary: "Debtor account receiving credit."
  total_amount:
    title: "Total Credit Amount"
    summary: "Gross credit adjustment including refunded sales tax."
  outstanding_amount:
    title: "Unallocated Credit Balance"
    summary: "Remaining credit available to offset future customer invoices or issue cash refunds."
related:
  - "sales-invoices"
  - "sales-returns"
  - "payments"
  - "balances"
---

# Sales Credit Notes

The **Sales Credit Notes** module manages issuing financial credit adjustments to customers for product returns, commercial discounts, price corrections, and goodwill credits.

---

## Credit Note Accounting & Allocations

```mermaid
flowchart TD
    A[Credit Note Created & Posted] --> B[General Ledger Posting]
    B --> C[Debit: Sales Revenue / Returns Allowance]
    B --> D[Debit: Output Tax / GST Payable]
    B --> E[Credit: Accounts Receivable Control Account]

    A --> F{Credit Note Settlement}
    F -->|Offset Open Invoices| G[Allocate Credit to Outstanding Invoices]
    F -->|Cash Refund| H[Process Customer Bank/Card Refund]
    F -->|Store Credit| I[Retain as Unallocated Credit Balance]
```

### 1. General Ledger Reversal Posting
Posting a Credit Note reduces revenue and customer AR debt:

```
Debit:  Sales Revenue / Returns Allowance  (Net Credit Amount)
Debit:  Output Tax / GST Payable           (Refunded Tax Total)
Credit: Accounts Receivable Control        (Total Gross Credit)
```

### 2. Credit Allocation vs. Cash Refunds
* **Invoice Allocation**: Credit notes can be matched and allocated directly against open customer invoices in the subledger without generating secondary GL entries.
* **Cash Refund**: If a customer requests cash return rather than store credit, a `customer_refund` payment entry debits Accounts Receivable and credits the Bank Account.

---

## Step-by-Step Workflows

### 1. Creating and Posting a Credit Note
1. Go to **Sales** → **Credit Notes** (`/sales-credit-notes`).
2. Click **Create Credit Note** to open the creation drawer slide-over.
3. Select the **Customer** and optional originating **Sales Invoice / Return**.
4. Add line items, reason codes, and credit values.
5. Click **Post Credit Note** to commit to the General Ledger.
6. In the allocation tab, apply the credit note across outstanding customer invoices or leave as an open unallocated credit.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Credit Note Number** | Legal reference (`CRN-...`). |
| **Customer** | Debtor account receiving credit. |
| **Gross Total** | Total credit value including tax. |
| **Unallocated Balance** | Open credit balance remaining for future use. |
| **Reason Code** | Commercial cause (Return, Billing Error, Damaged in Transit, Goodwill). |
