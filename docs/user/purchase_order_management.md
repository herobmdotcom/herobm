---
id: purchase-orders
title: "Purchase Orders"
description: "Manage supplier purchase orders, vendor holds, delivery schedules, document emailing, and dock receiving integration."
category: "Purchasing"
order: 18
resource: "orders"
action: "read"
routes:
  - "/purchase-orders"
  - "/purchase-orders/new"
  - "/purchase-orders/:id"
tags: ["purchasing", "po", "orders", "suppliers", "procurement", "receiving", "email", "supplier-hold"]
fields:
  vendor_id:
    title: "Supplier"
    summary: "Vendor account receiving the order."
  order_number:
    title: "PO Number"
    summary: "Unique purchase order identifier (e.g. PO-2026-00067)."
  expected_date:
    title: "Expected Delivery Date"
    summary: "Target date goods should arrive at the receiving dock."
  fulfillment_location_id:
    title: "Receiving Warehouse"
    summary: "Warehouse destination where inbound goods will be received."
  currency_code:
    title: "Currency"
    summary: "Purchasing currency snapshotted from supplier settings."
  state_code:
    title: "PO Status"
    summary: "Order state (Draft, Sent, Confirmed, Receiving, Received, Invoiced, Cancelled)."
related:
  - "suppliers"
  - "purchase-demands"
  - "receiving"
  - "purchase-returns"
  - "supplier-invoices"
---

# Purchase Orders

The **Purchase Orders** module manages procurement with external vendors. It tracks order placement, supplier purchasing holds, expected shipping schedules, automated document emailing, and dock receiving.

---

## Purchase Order Lifecycle & Rules

```mermaid
stateDiagram-v2
    [*] --> Draft : Create PO
    Draft --> Sent : Send to Supplier
    Draft --> Cancelled : Cancel

    Sent --> Confirmed : Supplier Acknowledges
    Sent --> Draft : Revise
    Sent --> Cancelled : Cancel

    Confirmed --> Receiving : First Item Received
    Receiving --> Received : 100% Received
    Received --> Invoiced : Supplier Invoice Matched
    Invoiced --> Closed : Complete
```

### State Definitions

| State | Meaning | What can be changed? |
| :--- | :--- | :--- |
| **Draft** | Order is being prepared. | Everything (supplier, lines, costs, quantities). |
| **Sent** | Order transmitted to supplier. | Locked. Can return to Draft to modify or move to Confirmed. |
| **Confirmed** | Supplier confirmed price and delivery date. | Locked. Ready for dock receiving. |
| **Receiving** | Warehouse has received partial quantities. | Locked. Open for further receipts. |
| **Received** | All line quantities fully received at the dock. | Locked. Ready for 3-way invoice matching. |
| **Invoiced** | Supplier bill matched and posted to AP. | Closed. |
| **Cancelled** | Order was cancelled. | Closed. |

---

## Key Purchasing Controls

### 1. Supplier Purchasing Holds
- If a vendor account is flagged with **Purchasing Hold** in [Suppliers](./suppliers.md), the system displays a prominent warning on order creation and blocks confirming new orders until authorized management removes the hold.

### 2. Direct Document Emailing
- Operators can transmit Purchase Orders directly to vendors via the **Email Document** modal.
- Generates a formatted Typst PDF attachment, pulls the vendor's primary purchasing contact email, and supports live PDF preview.

### 3. Return to Vendor (RTV) Integration
- For defective or excess received goods, click **Create Return** directly from the Purchase Order view to initiate a linked [Purchase Return](./purchase_returns_debit_notes.md).

---

## Step-by-Step Workflows

### 1. Creating and Sending a Purchase Order
1. Go to **Purchasing** → **Purchase Orders** (`/purchase-orders`).
2. Click **New Purchase Order** (`/purchase-orders/new`).
3. Select the **Supplier**. Currency and payment terms fill automatically.
4. Set the **Expected Delivery Date** and **Receiving Warehouse**.
5. Add line items, quantities, and agreed unit costs.
6. Click **Save as Draft**.
7. Click **Email Order** to send the purchase order PDF directly to the supplier's procurement desk.

### 2. Receiving and Completing an Order
1. When goods arrive at the dock, warehouse staff receive items via **Inventory** → **Receiving** (`/receiving`).
2. When all items are received, the PO automatically moves to **Received**.
3. When the supplier bill arrives, match it in **Supplier Invoices** (`/supplier-invoices`) to complete the order.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Supplier** | Vendor account. |
| **PO Number** | Unique purchase order reference. |
| **Expected Delivery** | Scheduled dock arrival date. |
| **Receiving Warehouse** | Target warehouse facility. |
| **Unit Cost** | Agreed purchase price per unit in supplier currency. |
| **Status** | Stage in procurement lifecycle. |
| **Supplier Hold** | Warning indicator shown if vendor is on operational hold. |
