---
id: purchase-returns
title: "Purchase Returns & Debit Notes"
description: "Return defective or excess stock to vendors (RTV), track vendor credit dockets, and issue Debit Notes."
category: "Purchasing"
order: 20
resource: "orders"
action: "read"
routes:
  - "/purchase-orders/returns"
  - "/purchase-debit-notes"
tags: ["purchase-returns", "rtv", "debit-notes", "suppliers", "ap", "purchasing"]
fields:
  return_number:
    title: "Purchase Return Number"
    summary: "Unique Return to Vendor identifier (e.g. RTV-2026-00012)."
  purchase_order_id:
    title: "Purchase Order"
    summary: "Original PO against which goods were received. (Supplier is relational via the PO)"
  debit_note_number:
    title: "Debit Note Number"
    summary: "Unique debit note identifier (e.g. DBN-2026-00008)."
  total_amount:
    title: "Debit Amount"
    summary: "Total value deducted from Accounts Payable."
related:
  - "purchase-orders"
  - "supplier-invoices"
  - "inventory-shipping"
  - "balances"
---

# Purchase Returns & Debit Notes

The **Purchase Returns & Debit Notes** module handles returning damaged, defective, or over-shipped goods to vendors (Return to Vendor - RTV) and recovering financial value via Debit Notes.

---

## Return to Vendor (RTV) Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Draft : Create RTV Request
    Draft --> Confirmed : Vendor Authorizes Return
    Confirmed --> Dispatched : Ship Goods Back
    Dispatched --> Completed : Vendor Issues Credit / Debit Note
    Draft --> Cancelled : Cancel
```

### 1. General Ledger Impact of Debit Notes
Posting a debit note reduces your liability to the supplier:
- **Debit**: Accounts Payable (Vendor balance decreases)
- **Credit**: Inventory Asset / Expense Account
- **Credit**: Input Tax / GST Recoverable (reversing input tax)

---

## Step-by-Step Workflows

### 1. Returning Goods to a Supplier
1. Go to **Purchasing** → **Purchase Returns** (`/purchase-orders/returns`).
2. Click **+ New Purchase Return** and select the **Purchase Order**.
3. Choose the items and quantities to return and select a **Reason Code**.
4. Click **Confirm Return**.
5. Warehouse staff pack and dispatch the items via **Inventory** → **Shipping** → **Supplier Returns**.
6. When the vendor issues credit or replaces items, post the **Debit Note** in **Purchasing** → **Debit Notes** (`/purchase-debit-notes`) to reduce Accounts Payable.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Return Number (RTV)** | Return authorization reference. |
| **Purchase Order** | Original PO for relational details like supplier. |
| **Debit Note Number** | Legal debit adjustment identifier. |
| **Debit Amount** | Total deducted balance. |
| **Status** | Stage (`Draft`, `Confirmed`, `Dispatched`, `Completed`). |
