---
id: suppliers
title: "Suppliers & Vendors"
description: "Manage supplier accounts, purchasing currencies, vendor payment terms, contacts, and lead times."
category: "Purchasing"
order: 16
resource: "suppliers"
action: "read"
routes:
  - "/suppliers"
  - "/suppliers/new"
  - "/suppliers/:id"
tags: ["suppliers", "vendors", "purchasing", "ap", "terms", "lead-times"]
fields:
  name:
    title: "Supplier Name"
    summary: "Legal trade name of the vendor or supplier company."
  supplier_group_id:
    title: "Supplier Group"
    summary: "Categorizes vendors for spend analysis and default accounting codes."
  currency_code:
    title: "Purchasing Currency"
    summary: "Operating currency used on purchase orders and supplier invoices."
  trading_terms_id:
    title: "Payment Terms"
    summary: "Standard vendor settlement window (e.g. Net 30, Net 60, EOM)."
related:
  - "purchase-orders"
  - "purchase-demands"
  - "supplier-invoices"
  - "balances"
---

# Suppliers & Vendors

The **Suppliers** module manages vendor master records, payment terms, purchasing currencies, supplier groups, and vendor lead times.

---

## Supplier Management Rules

### 1. Unified Vendor Profiles
Suppliers share the same underlying Organization model as customers, enabling companies that both buy and sell with you to maintain synchronized contact details and addresses without duplicate data entry.

### 2. Multi-Currency Purchasing
Each supplier has an assigned purchasing currency (e.g. `USD`, `EUR`, `AUD`, `GBP`). When raising a purchase order, current FX rates convert line costs to the system base currency for accurate inventory valuation and General Ledger commitments.

### 3. Vendor Trading Terms & Settlement Schedules
Vendor trading terms determine the legal payment deadline on supplier bills (AP invoices) and directly influence Accounts Payable cash disbursement planning:

* **Inheritance Cascade**:
  `1. Supplier Profile Override` → `2. Supplier Group Defaults` → `3. System Default (Financial Settings)` → `4. Immediate / Cash Basis Fallback`
* **Due Date Calculation**:
  * **Net Terms (`net`)**: `Due Date = Bill Date + Days` (e.g. `NET30` sets payment due 30 days after the vendor invoice date).
  * **End of Month (`end_of_month`)**: `Due Date = Last Day of Bill Month + Days` (e.g. `EOM30` sets due date 30 days after the close of the invoice month).
  * **Cash on Delivery (`cash_on_delivery`)**: `Due Date = Bill Date` (immediate payment upon delivery).

### 4. Operational & Purchasing Holds
If a supplier is flagged **On Purchasing Hold**, the system warns operators and prevents advancing new purchase orders to `Ordered` state until the hold is resolved and lifted by an authorized user.

---

## Step-by-Step Workflows

### 1. Adding a New Supplier
1. Go to **Purchasing** → **Suppliers** (`/suppliers`).
2. Click **New Supplier** (`/suppliers/new`).
3. Enter the **Company Name**, **Supplier Group**, and **Purchasing Currency**.
4. Set the **Payment Terms** (e.g. `NET30`, `EOM30`, or inherit from Supplier Group) and **Default Lead Time**.
5. Add the primary **Billing Address** and supplier contact email.
6. Click **Save Supplier**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Supplier Name** | Legal business name. |
| **Supplier Group** | Vendor category setting default AP account, spend analytics tags, and default payment terms. |
| **Purchasing Currency** | Operating currency for PO line costs. |
| **Payment Terms** | Agreed settlement timeline (Net days, End of Month, COD) determining supplier invoice due dates. |
| **Purchasing Hold** | Flag indicating operational block on raising confirmed purchase orders. |

