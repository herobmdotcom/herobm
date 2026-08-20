---
id: sales-credit-notes
title: "Sales Credit Notes"
description: "Issue credit notes for returns or billing adjustments and allocate credits to open customer invoices."
category: "Sales"
order: 8
resource: "invoices"
action: "read"
routes:
  - "/sales-credit-notes"
  - "/sales-credit-notes/:id"
tags: ["credit-notes", "sales", "adjustments", "refunds", "ar"]
fields:
  credit_note_number:
    title: "Credit Note Number"
    summary: "Unique credit note identifier (e.g. CRN-2026-00054)."
  customer_id:
    title: "Customer"
    summary: "Customer account receiving the credit balance."
  invoice_id:
    title: "Associated Invoice"
    summary: "Sales invoice being credited (if linked to a specific bill)."
  total_amount:
    title: "Total Amount"
    summary: "Total amount credited including tax."
  outstanding_amount:
    title: "Outstanding Amount"
    summary: "Remaining credit available to offset future orders or issue cash refunds. Allocations are computed dynamically."
related:
  - "sales-invoices"
  - "sales-returns"
  - "balances"
  - "payments"
---

# Sales Credit Notes

The **Credit Notes** module handles negative customer balances resulting from sales returns, pricing adjustments, or commercial goodwill credits.

---

## Accounting & Allocation Rules

### 1. General Ledger Impact
Posting a credit note creates an automatic reversing entry in the General Ledger:
- **Debit**: Sales Revenue or Returns Expense
- **Debit**: Tax / GST Payable (reversing output tax)
- **Credit**: Accounts Receivable (reducing customer balance)

### 2. Credit Allocation
- A credit note can be **allocated directly** to open, unpaid sales invoices for that customer.
- If unallocated, the credit remains on the customer's account as an available credit balance, which can be applied to future invoices or refunded via bank payout.

---

## Step-by-Step Workflows

### 1. Creating a Standalone Credit Note
1. Go to **Sales** → **Credit Notes** (`/sales-credit-notes`).
2. Click **New Credit Note**.
3. Select the **Customer** and (optional) linked **Sales Invoice**.
4. Add line descriptions, credited amounts, and tax classifications.
5. Click **Post Credit Note**.

### 2. Allocating Credit to an Open Invoice
1. Open the posted credit note.
2. Click **Allocate to Invoice**.
3. Select the target open invoice and enter the amount to apply.
4. Click **Confirm Allocation**. The open invoice balance is immediately reduced.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Credit Note Number** | Legal credit note document reference. |
| **Customer** | Credited customer account. |
| **Total Amount** | Total credit value. |
| **Outstanding Amount** | Unmatched credit remaining on account. Allocations are computed dynamically. |
