---
id: sales-invoices
title: "Sales Invoices"
description: "Issue customer invoices, manage payment terms, record tax, and post directly to Accounts Receivable."
category: "Sales"
order: 6
resource: "invoices"
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

The **Sales Invoices** module handles customer billing. Generating and posting an invoice records tax liabilities, posts Accounts Receivable to the General Ledger, and updates order completion states.

---

## Invoicing Rules & Accounting Integration

### 1. Generating Invoices from Orders
- Invoices can be generated directly from confirmed or shipped Sales Orders.
- **Partial Invoicing**: If an order is delivered in stages, multiple partial invoices can be raised against individual shipments.
- **Auto-Completion**: When 100% of an order's line items have been billed across invoices, the Sales Order automatically transitions to `invoiced`.

### 2. General Ledger Posting
Posting a sales invoice creates an automatic balanced journal entry in the General Ledger:
- **Debit**: Accounts Receivable (Customer balance increases)
- **Credit**: Sales Revenue (Product income accounts)
- **Credit**: Tax / GST Payable (Tax output liability)

---

## Step-by-Step Workflows

### 1. Generating a Sales Invoice
1. Go to **Sales** → **Sales Invoices** (`/sales-invoices`).
2. Click **+ New Invoice**.
3. Select the **Sales Order** from the search list.
4. Review the billed quantities, unit prices, discounts, and tax rates.
5. Verify the **Invoice Date** and calculated **Due Date**.
6. Click **Post Invoice** to finalize the billing and update the General Ledger.
7. Click **PDF** or **Email** to send the official tax invoice to the customer.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Invoice Number** | Legal tax invoice identifier. |
| **Customer** | Billed customer account. |
| **Sales Order** | Originating sales order reference. |
| **Invoice Date** | Official billing date. |
| **Due Date** | Payment settlement deadline based on terms. |
| **Subtotal** | Net amount before tax. |
| **Tax Amount** | Calculated GST / VAT. |
| **Total Amount** | Gross payable amount in customer currency. |
