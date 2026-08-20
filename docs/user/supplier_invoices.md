---
id: supplier-invoices
title: "Supplier Invoices & 3-Way Matching"
description: "Verify supplier bills against Purchase Orders and Goods Receipts, record input tax, and post to Accounts Payable."
category: "Purchasing"
order: 19
resource: "invoices"
action: "read"
routes:
  - "/supplier-invoices"
  - "/supplier-invoices/:id"
tags: ["supplier-invoices", "bills", "ap", "3-way-match", "purchasing", "tax"]
fields:
  supplier_invoice_number:
    title: "Supplier Bill / Invoice Number"
    summary: "External tax invoice number issued by the vendor."
  vendor_id:
    title: "Vendor"
    summary: "Vendor account being paid."
  purchase_order_id:
    title: "Purchase Order"
    summary: "Associated PO matched against this invoice."
  invoice_date:
    title: "Bill Date"
    summary: "Date of vendor bill for accounting period allocation."
  due_date:
    title: "Due Date"
    summary: "Payment deadline based on supplier trading terms."
  total_amount:
    title: "Invoice Total"
    summary: "Gross amount payable including input tax."
related:
  - "purchase-orders"
  - "receiving"
  - "suppliers"
  - "balances"
---

# Supplier Invoices & 3-Way Matching

The **Supplier Invoices** module verifies vendor bills against purchase orders and warehouse receipts before posting liabilities to Accounts Payable.

---

## The 3-Way Matching Rule

To ensure financial integrity and prevent over-billing, the system performs a **3-Way Match**:

```mermaid
flowchart TD
    PO[1. Purchase Order<br/>Agreed Price & Qty] --- GRN[2. Goods Receipt Note<br/>Physical Qty Received]
    GRN --- INV[3. Supplier Invoice<br/>Billed Price & Qty]
    PO --- INV
    INV --> Match{Values Match within Tolerance?}
    Match -- Yes --> Post[Post to Accounts Payable & GL]
    Match -- No --> Hold[Flag Price/Qty Variance for Review]
```

### General Ledger Postings
Posting a supplier invoice creates a balanced journal entry:
- **Debit**: Inventory Asset / Expense Account
- **Debit**: Input Tax / GST Recoverable
- **Credit**: Accounts Payable (Vendor balance increases)

---

## Step-by-Step Workflows

### 1. Recording and Matching a Supplier Bill
1. Go to **Purchasing** → **Supplier Invoices** (`/supplier-invoices`).
2. Click **New Supplier Invoice**.
3. Select the **Supplier** and the linked **Purchase Order**.
4. Enter the vendor's official **Supplier Invoice Number** and **Bill Date**.
5. The system pulls lines from the associated Goods Receipt Notes (GRN).
6. Verify line prices and quantities against the vendor's paper/PDF bill.
7. Click **Post Invoice** to record the payable balance in the General Ledger.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Supplier Bill Number** | Vendor's invoice reference. |
| **Vendor** | Payee vendor account. |
| **Purchase Order** | Originating procurement order. |
| **Due Date** | Settlement deadline. |
| **Subtotal** | Net bill amount. |
| **Input Tax** | GST / VAT recoverable on purchase. |
| **Total Amount** | Gross payable amount in supplier currency. |
