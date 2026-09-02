---
id: sales-credit-notes
title: "Sales Credit Notes"
description: "Issue credit notes for returns or billing adjustments and allocate credits to open customer invoices."
category: "Sales"
order: 8
resource: "sales-credit-notes"
action: "read"
routes:
  - "/sales-credit-notes"
  - "/sales-credit-notes/history"
  - "/sales-credit-notes/operations"
  - "/sales-credit-notes/:id"
tags: ["credit-notes", "sales", "adjustments", "refunds", "ar", "allocations"]
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
    summary: "Remaining unallocated credit available to offset future invoices or issue cash refunds."
related:
  - "sales-invoices"
  - "sales-returns"
  - "balances"
  - "payments"
---

# Sales Credit Notes

The **Credit Notes** module handles negative customer balances resulting from sales returns, pricing adjustments, or commercial goodwill credits.

---

## Business Logic & Allocation Mechanics

### 1. General Ledger Postings
Posting a Sales Credit Note immediately creates a balanced double-entry transaction in the General Ledger:

```
Debit:  Sales Revenue / Sales Returns Account   (Reduces reported revenue)
Debit:  Output Tax Liability (Tax Payable)      (Reverses previously recognized tax)
Credit: Accounts Receivable Control Account     (Reduces customer outstanding balance)
```

### 2. Credit Allocation Equation & Subledger Balance
Credit notes can either be linked to a specific originating invoice or created standalone:

```
Invoice Outstanding Balance = Invoice Gross Total - Allocated Payments - Allocated Credit Notes
Credit Note Unallocated Amount = Credit Note Gross Total - Sum(Allocated Amounts to Invoices)
```

* **Allocation Impact**: Allocating a credit note to an open invoice is an operational subledger matching action. Because Accounts Receivable was already credited at the moment of credit note posting, **no second GL entry is generated** upon allocation; the allocation simply links the subledger records and decrements both outstanding balances.
* **Customer Balance & Aged AR**: Credit notes immediately reduce the customer's total open balance. In aged receivable reports, unallocated credit notes are applied against the oldest aging buckets (or displayed in the unallocated credit column).

### 3. Payout via Cash Refund
If a customer requests a cash payout rather than carrying forward account credit:
1. An operator creates a **Payment Entry** of type `customer_refund`.
2. The refund entry matches against the unallocated credit note, posting:
   ```
   Debit:  Accounts Receivable Control Account
   Credit: Bank Account
   ```

---

## Step-by-Step Workflows

### 1. Creating a Credit Note
1. Go to **Sales** → **Credit Notes** (`/sales-credit-notes`).
2. Click **New Credit Note**.
3. Select the **Customer** and (optional) linked **Sales Invoice**.
4. Add line items, credited amounts, and tax classifications.
5. Click **Post Credit Note** to post to Accounts Receivable and the General Ledger.

### 2. Allocating Credit to an Open Invoice
1. Open the posted credit note (`/sales-credit-notes/:id`).
2. In the **Allocations** panel, click **Allocate to Invoice**.
3. Select the target unpaid invoice and enter the allocation amount.
4. Click **Confirm Allocation**. Both the credit note and invoice outstanding balances update immediately.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Credit Note Number** | Legal credit note document reference (e.g. `CRN-2026-00054`). |
| **Customer** | Credited customer account. |
| **Associated Invoice** | Linked sales invoice if raised for a specific bill correction. |
| **Total Amount** | Total gross credit value including tax. |
| **Outstanding Amount** | Unallocated credit balance remaining on the account. |
| **Status** | Stage (`Draft`, `Posted`, `Cancelled`). |
