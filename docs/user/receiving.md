---
id: receiving
title: "Goods Receiving"
description: "Process inbound supplier deliveries, customer returns, and incoming inter-warehouse transfers."
category: "Inventory"
order: 12
resource: "inventory"
action: "read"
routes:
  - "/receiving"
  - "/receiving/new"
  - "/receiving/returns"
  - "/receiving/transfers"
tags: ["receiving", "inbound", "suppliers", "receipts", "grn", "returns", "grni", "wac"]
fields:
  receipt_number:
    title: "Goods Receipt Note (GRN)"
    summary: "Unique inbound receipt record (e.g. GRN-2026-00155)."
  purchase_order_id:
    title: "Purchase Order"
    summary: "Supplier purchase order against which items are being received."
  packing_slip_number:
    title: "Supplier Delivery Note / Slip"
    summary: "External consignment or carrier tracking number on supplier packaging."
  received_quantity:
    title: "Received Quantity"
    summary: "Actual verified physical count accepted at the dock."
  unit_cost:
    title: "Receipt Unit Cost"
    summary: "Purchasing cost per unit used for inventory capitalization and GRNI accrual."
related:
  - "purchase-orders"
  - "putaway"
  - "sales-returns"
  - "supplier-invoices"
---

# Inbound Goods Receiving

The **Receiving** module manages inbound freight at the warehouse dock — processing supplier purchase orders, customer returns (RMA), and incoming stock transfers.

---

## Receiving Logic & Automated Financial Postings

```mermaid
flowchart TD
    A[Inbound Freight Arrives at Dock] --> B[Select PO & Verify Received Counts]
    B --> C[Generate Goods Receipt Note GRN]
    C --> D[1. Recalculate Product Moving WAC Costing]
    C --> E[2. Post GRNI Accrual to General Ledger]
    C --> F[3. Increment Physical On-Hand in Dock Staging Bin]
    C --> G[4. Auto-Transition Purchase Order State]
```

### 1. General Ledger Accrual (GRNI Clearance Gate)
Confirming a Goods Receipt Note (GRN) immediately recognizes inventory assets in the General Ledger before vendor invoices arrive:

```
Debit:  Inventory Asset Account               (Qty Received * Actual Unit Cost)
Credit: Goods Received Not Invoiced (GRNI)    (Qty Received * Actual Unit Cost)
```

* Under Standard Costing, inventory is debited at standard cost and any difference against PO cost is posted to Purchase Price Variance (PPV).

### 2. Moving WAC Recalculation
Every Goods Receipt automatically recalculates the product's **Moving Weighted Average Cost**:

```
New WAC = ((Current QOH * Current WAC) + (Qty Received * Actual Unit Cost)) / (Current QOH + Qty Received)
```

* The new WAC is saved to 4 decimal places and becomes the active valuation baseline for subsequent COGS dispatches.

### 3. Purchase Order Auto-Transitions
The system evaluates line-level receipt progress automatically:
* **Partial Delivery**: If `0 < Total Received < Total Ordered`, the PO transitions to `Partially Received`.
* **Full Delivery**: When `Total Received >= Total Ordered` across all lines, the PO transitions to `Received` (`auto-receive-when-fully-received` rule), enabling 3-way invoice matching.

### 4. Damaged Inbound Stock
Damaged units identified upon delivery can be routed directly to a **Quarantine Bin**, preventing them from entering active stock while preserving the accurate GRNI accrual liability until replacement or debit notes are processed.

---

## Step-by-Step Workflows

### 1. Receiving a Supplier Purchase Order
1. Go to **Inventory** → **Receiving** → **Supplier Receipts** (`/receiving`).
2. Click **New Receipt** (`/receiving/new`) and select the **Purchase Order**.
3. Enter the supplier's **Delivery Note / Packing Slip Number**.
4. For each line item, enter the physical **Received Quantity** and assign to the dock staging bin (or quarantine bin for damaged goods).
5. Click **Confirm Receipt** to generate the official GRN, recalculate WAC, and post the GRNI GL accrual.

### 2. Receiving Customer Returns (RMA)
1. Go to **Inventory** → **Receiving** → **Customer Returns** (`/receiving/returns`).
2. Select the confirmed return authorization.
3. Verify returned item condition, count received quantities, and click **Accept & Restock**.

### 3. Receiving Incoming Stock Transfers
1. Go to **Inventory** → **Receiving** → **Incoming Transfers** (`/receiving/transfers`).
2. Select the in-transit transfer order.
3. Verify arriving counts and click **Receive Transfer** to deposit units into destination staging.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Receipt Number (GRN)** | Unique goods receipt identifier (e.g. `GRN-2026-00155`). |
| **Purchase Order** | Parent supplier purchase order reference (`PO-...`). |
| **Supplier Slip Number** | External delivery docket reference from the supplier/carrier. |
| **Received Quantity** | Verified physical count accepted at the dock. |
| **Receipt Unit Cost** | Capitalized inventory cost per unit. |
| **Staging Bin** | Inbound holding bin where goods are staged before putaway. |
