---
id: supplier-invoices
title: "Supplier Invoices & 3-Way Matching"
description: "Verify supplier bills against Purchase Orders and Goods Receipts, record input tax, clear GRNI accruals, and post to Accounts Payable."
category: "Purchasing"
order: 19
resource: "invoices"
action: "read"
routes:
  - "/supplier-invoices"
  - "/supplier-invoices/:id"
tags: ["supplier-invoices", "bills", "ap", "3-way-match", "purchasing", "tax", "grni", "ppv", "variance"]
fields:
  supplier_invoice_number:
    title: "Supplier Bill / Invoice Number"
    summary: "External tax invoice identifier issued by the vendor."
  vendor_id:
    title: "Vendor"
    summary: "Vendor account being credited in Accounts Payable."
  purchase_order_id:
    title: "Purchase Order"
    summary: "Associated procurement order matched against this invoice."
  invoice_date:
    title: "Bill Date"
    summary: "Date of vendor bill for accounting period allocation."
  due_date:
    title: "Due Date"
    summary: "Payment deadline based on supplier trading terms."
  exchange_rate:
    title: "Exchange Rate"
    summary: "FX rate at invoice date used to convert foreign supplier bills to base currency (EUR)."
  total_amount:
    title: "Invoice Total"
    summary: "Gross amount payable in vendor currency including input tax."
related:
  - "purchase-orders"
  - "receiving"
  - "suppliers"
  - "balances"
  - "general-ledger"
---

# Supplier Invoices & 3-Way Matching

The **Supplier Invoices** module verifies external vendor bills against purchase orders and warehouse dock receipts (GRN) before posting financial liabilities to Accounts Payable.

---

## 3-Way Matching Logic & Variance Decomposition

To ensure financial integrity, prevent duplicate billing, and isolate currency fluctuations from commercial price changes, the system performs a continuous **3-Way Match**:

```mermaid
flowchart TD
    PO[1. Purchase Order<br/>Agreed Cost & PO Rate] --- GRN[2. Goods Receipt Note<br/>Physical Qty Received]
    GRN --- INV[3. Supplier Invoice<br/>Billed Cost & Invoice Rate]
    PO --- INV
    INV --> Calc[Decompose Line Variances]
    Calc --> Post[Post Multi-Leg GL Journal Entry]
```

### 1. Multi-Currency Variance Decomposition
When matching an AP invoice against goods receipts, the system calculates two distinct variance components:

```
Receipt Base Cost = Quantity Billed * Receipt Unit Cost (GRN)
Foreign Cost = Receipt Base Cost / PO Exchange Rate
Trade Price Variance (PPV Base) = Invoice Base Amount - (Foreign Cost * Invoice Exchange Rate)
FX Rate Variance = (Foreign Cost * Invoice Exchange Rate) - Receipt Base Cost
```

* **Trade Price Variance (Purchase Price Variance / PPV)**: Measures commercial price differences negotiated vs billed in constant currency.
* **FX Rate Variance**: Isolates currency exchange movement between the date the purchase order was placed and the date the supplier invoice was received.

### 2. General Ledger Automated Postings
Posting a matched supplier invoice creates a multi-leg journal entry that clears the temporary goods receipt accrual and establishes the Accounts Payable liability:

```
Debit:  Goods Received Not Invoiced (GRNI)  (Receipt Base Cost - Clears goods receipt accrual)
Debit/Credit: Purchase Price Variance (PPV) (Trade price variance)
Debit/Credit: Foreign Exchange (FX) Variance(Currency exchange variance)
Debit:  Input Tax / GST Recoverable         (Tax Amount Base)
Credit: Accounts Payable Control Account    (Total Invoice Amount Base)
```

* **Unmatched Expense Invoices**: If an invoice line is not linked to a Purchase Order (e.g. utility bills, freight fees), the operator must explicitly assign an active GL Expense Account, Cost Center, and Activity before posting.

---

## Step-by-Step Workflows

### 1. Recording and Matching a Supplier Bill
1. Go to **Purchasing** → **Supplier Invoices** (`/supplier-invoices`).
2. Click **New Supplier Invoice**.
3. Select the **Supplier** and linked **Purchase Order**.
4. Enter the vendor's official **Supplier Invoice Number** and **Bill Date**.
5. The system automatically loads associated unbilled Goods Receipt Notes (GRN).
6. Verify billed quantities, unit prices, and tax categories against the vendor's physical/PDF bill.
7. Click **Post Invoice** to record the payable liability in Accounts Payable, clear GRNI accruals, and update the General Ledger.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Supplier Bill Number** | Official vendor invoice reference (e.g. `INV-98214`). |
| **Vendor** | Payee vendor account credited in Accounts Payable. |
| **Purchase Order** | Parent procurement order matched to this bill. |
| **Bill Date** | Effective transaction date for fiscal period posting. |
| **Due Date** | Payment deadline computed from vendor trading terms. |
| **Subtotal** | Net invoice amount before tax in vendor currency. |
| **Input Tax** | GST / VAT recoverable on business purchases. |
| **Total Amount** | Gross payable liability in vendor currency. |
| **Exchange Rate** | FX spot rate used to translate invoice totals to base currency (`EUR`). |

