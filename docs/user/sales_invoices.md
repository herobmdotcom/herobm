---
id: sales-invoices
title: "Sales Invoices"
description: "Issue customer invoices, manage payment terms, record tax, and post directly to Accounts Receivable."
category: "Sales"
order: 6
resource: "sales-invoices"
action: "read"
routes:
  - "/sales-invoices"
  - "/sales-invoices/:id"
tags: ["invoices", "sales", "billing", "ar", "tax", "payments"]
fields:
  invoice_number:
    title: "Invoice Number"
    summary: "Sequential tax invoice number (e.g. INV-2026-00312)."
  customer_id:
    title: "Customer"
    summary: "Customer account billed for goods or services."
  sales_order_id:
    title: "Sales Order"
    summary: "Originating sales order linked to this invoice."
  invoice_date:
    title: "Invoice Date"
    summary: "Date of issue for tax and reporting purposes."
  due_date:
    title: "Due Date"
    summary: "Payment due date calculated from customer trading terms."
  currency_code:
    title: "Currency"
    summary: "Invoice currency, matching the sales order."
  total_amount:
    title: "Invoice Total"
    summary: "Grand total including line amounts and tax."
related:
  - "sales-orders"
  - "customers"
  - "payments"
  - "general-ledger"
---

# Sales Invoices

The **Sales Invoices** module handles customer billing. Generating and posting an invoice records tax liabilities, posts Accounts Receivable to the General Ledger, and tracks payment settlement progress.

---

## Invoicing Rules & Accounting Integration

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Invoice
    Draft --> Posted : Post to General Ledger
    Draft --> Cancelled : Discard

    Posted --> PartiallyPaid : Partial Payment Allocated
    Posted --> Paid : Fully Paid
    Posted --> Cancelled : Reversal (Credit Adjustment)

    PartiallyPaid --> Paid : Final Settlement
    PartiallyPaid --> Cancelled : Void Unsettled Balance

    Paid --> Archived : Archiving
    Cancelled --> Archived : Archiving
```

### 1. Generating Invoices from Orders
- Invoices can be generated directly from confirmed or shipped Sales Orders.
- **Partial Invoicing**: If an order is delivered in stages, multiple partial invoices can be raised against individual shipments.
- **Auto-Completion**: When 100% of an order's line items have been billed across invoices, the parent Sales Order automatically transitions to `invoiced`.

### 2. General Ledger Posting
Posting a sales invoice creates an automatic balanced journal entry in the General Ledger:
- **Debit**: Accounts Receivable Control Account (Customer balance increases)
- **Credit**: Sales Revenue (Product income accounts)
- **Credit**: Tax / GST Payable (Tax output liability)

### 3. Tax Compliance & Immutability Guarantees
- **No Hard Deletions**: Invoices, credit notes, and invoice line items are protected by database triggers (`herobm_core.prevent_financial_deletion`). Once created, they cannot be deleted or truncated.
- **Compensating Corrections**: Errors or cancellations must be handled via **Cancellation** (which posts an automatic reversing journal entry) or by issuing a **Sales Credit Note**.
- **Sequential Auditing**: Invoices follow chronological sequential numbering. An automated background verification engine runs scheduled audits to guarantee gapless continuity.

---

## Step-by-Step Workflows

### 1. Generating a Sales Invoice
1. Go to **Sales** → **Sales Invoices** (`/sales-invoices`).
2. Click **New Invoice**.
3. Select the **Sales Order** from the search list.
4. Review the billed quantities, unit prices, discounts, and tax rates.
5. Verify the **Invoice Date** and calculated **Due Date**.
6. Click **Post Invoice** to finalize the billing and update the General Ledger.
7. Click **PDF** or **Email** to send the official tax invoice to the customer.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Invoice Number** | Legal tax invoice identifier (e.g. `INV-2026-00312`). |
| **Customer** | Billed customer account. |
| **Sales Order** | Originating sales order reference (`ORD-...`). |
| **Invoice Date** | Official billing date. |
| **Due Date** | Payment settlement deadline based on terms. |
| **Subtotal** | Net amount before tax. |
| **Tax Amount** | Calculated GST / VAT. |
| **Total Amount** | Gross payable amount in customer currency. |
| **Status** | Stage (`Draft`, `Posted`, `Partially Paid`, `Paid`, `Cancelled`, `Archived`). |
