---
id: purchase-returns
title: "Purchase Returns & Debit Notes"
description: "Return defective or excess stock to vendors (RTV), stage goods at the dock, track return shipments, and issue Debit Notes."
category: "Purchasing"
order: 20
resource: "purchase-returns"
action: "read"
routes:
  - "/purchase-orders/returns"
  - "/purchase-orders/returns/new"
  - "/purchase-debit-notes"
tags: ["purchase-returns", "rtv", "debit-notes", "suppliers", "ap", "purchasing", "email", "pdf", "allocations"]
fields:
  return_number:
    title: "Purchase Return Number"
    summary: "Unique Return to Vendor identifier (e.g. RTV-2026-00012)."
  purchase_order_id:
    title: "Purchase Order"
    summary: "Original PO against which goods were received."
  debit_note_number:
    title: "Debit Note Number"
    summary: "Unique debit note identifier (e.g. DBN-2026-00008)."
  total_amount:
    title: "Debit Amount"
    summary: "Total gross debit adjustment deducted from Accounts Payable."
  outstanding_amount:
    title: "Unallocated Debit Balance"
    summary: "Remaining debit balance available to offset future supplier invoices or receive cash refunds."
related:
  - "purchase-orders"
  - "supplier-invoices"
  - "inventory-shipping"
  - "balances"
---

# Purchase Returns & Debit Notes

The **Purchase Returns & Debit Notes** module handles returning damaged, defective, or over-shipped goods to vendors (Return to Vendor - RTV), generating return documentation, emailing vendors, and recovering financial value via Debit Notes.

---

## Return to Vendor Lifecycle & Business Logic

```mermaid
stateDiagram-v2
    [*] --> Draft : Create RTV Request
    Draft --> Staged : Stage Goods at Dock
    Draft --> Cancelled : Cancel

    Staged --> Shipped : Dispatch Return (Perpetual Inventory Decrement)
    Staged --> Draft : Unstage / Edit
    Staged --> Cancelled : Cancel

    Cancelled --> Draft : Reopen
```

### 1. Return States & Inventory Progression

* **`Draft`**: The return request is created, identifying items, quantities, and return reasons. Physical inventory remains in its current storage or quarantine bin.
* **`Staged`**: Return items are pulled and staged at the dispatch dock (`apps/api` action `stage`). Stock is reserved for return shipping.
* **`Shipped`**: The carrier collects the return shipment (`apps/api` action `ship`). Physical stock is decremented from inventory ledgers, and the return is finalized.
* **`Cancelled`**: The return is aborted, releasing any staged stock reservations.

### 2. Purchase Order State Reversion Trigger
When an outbound return shipment is marked **Shipped**:
* The system deducts the returned quantity from the PO's cumulative `Quantity Received`.
* If net received quantity drops below the ordered quantity, the rules engine automatically executes **`auto-revert-to-partially-received-on-return`**, reopening the PO to `Partially Received` so replacement items can be received at the dock.

### 3. General Ledger Postings for Debit Notes
Posting a Debit Note in **Purchasing** → **Debit Notes** (`/purchase-debit-notes`) reduces the Accounts Payable liability owed to the vendor:

```
Debit:  Accounts Payable Control Account    (Reduces total vendor liability)
Credit: Inventory Asset / Returns Clearing  (Decrements inventory asset balance)
Credit: Input Tax / GST Recoverable         (Reverses claimed input tax)
```

### 4. Allocation Against Open Supplier Invoices
Debit notes can be matched directly against outstanding supplier bills:

```
Supplier Bill Outstanding = Bill Gross Total - Allocated Payments - Allocated Debit Notes
Debit Note Unallocated Balance = Debit Note Gross Total - Sum(Allocated Invoice Amounts)
```

* **No Secondary GL Entry**: Allocation is an operational subledger action that decrements open balances on both documents simultaneously.
* **Cash Refund**: If the vendor remits a bank refund rather than offsetting future bills, a `supplier_refund` payment entry debits the Bank Account and credits Accounts Payable.

---

## Step-by-Step Workflows

### 1. Creating and Dispatching a Supplier Return
1. Go to **Purchasing** → **Purchase Returns** (`/purchase-orders/returns`).
2. Click **New Purchase Return** (`/purchase-orders/returns/new`) and select the originating **Purchase Order**.
3. Choose the items, return quantities, origin storage/quarantine bins, and select a **Reason Code**.
4. Click **Stage Return** to move items to dock staging.
5. Click **Email Return Slip** to send the return docket to the supplier's RMA desk.
6. When the carrier collects the goods, confirm dispatch to transition the return to **Shipped**.

### 2. Issuing and Allocating a Debit Note
1. Go to **Purchasing** → **Debit Notes** (`/purchase-debit-notes`).
2. Click **New Debit Note** and select the **Supplier** and originating return references.
3. Review line amounts and applicable tax categories.
4. Click **Post Debit Note** to record the financial AP reduction.
5. Allocate the available debit balance across open supplier bills in the allocation table.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Return Number (RTV)** | Unique return authorization reference (e.g. `RTV-2026-00012`). |
| **Purchase Order** | Original PO for relational details like vendor and price history. |
| **Debit Note Number** | Legal debit adjustment identifier (e.g. `DBN-2026-00008`). |
| **Debit Amount** | Total gross deducted balance including tax. |
| **Unallocated Balance** | Remaining credit remaining on the vendor's AP ledger. |
| **Reason Code** | Classification for the return (Damaged, Over-shipped, Defective, Wrong Item). |
| **Status** | Stage (`Draft`, `Staged`, `Shipped`, `Cancelled`). |
