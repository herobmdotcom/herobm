---
id: putaway
title: "Putaway Operations"
description: "Move received goods, customer returns, incoming transfers, and manufactured assemblies into optimal warehouse storage bins."
category: "Inventory"
order: 13
resource: "inventory"
action: "read"
routes:
  - "/inventory/putaway"
tags: ["putaway", "warehouse", "bins", "storage", "receiving", "returns", "transfers", "work-orders"]
fields:
  goods_received_line_id:
    title: "Source Receipt Line"
    summary: "Dock receipt item awaiting putaway into storage."
  suggested_bin_id:
    title: "Candidate Storage Bin"
    summary: "Available storage bin filtered by active status and accessibility."
  quantity:
    title: "Putaway Quantity"
    summary: "Number of units physically transferred from receiving staging to storage."
related:
  - "receiving"
  - "inventory-management"
  - "transfers-quarantine"
  - "work-orders"
---

# Putaway Operations

The **Putaway** module manages moving inbound inventory from temporary dock staging into permanent warehouse storage locations.

---

## Multi-Stream Putaway Architecture

Items enter the Putaway Queue (`/inventory/putaway`) from four operational streams:

```mermaid
flowchart TD
    A[1. Supplier Purchase Order Receipts] --> E[Putaway Queue /inventory/putaway]
    B[2. Customer RMA Sales Returns] --> E
    C[3. Inter-Warehouse Incoming Transfers] --> E
    D[4. Completed Work Order Assemblies] --> E

    E --> F[Select Item & Inspect Candidate Bins]
    F --> G[Confirm Destination Bin & Quantity]
    G --> H[Transfer Stock from Staging Bin to Permanent Storage Bin]
```

### 1. Multi-Stream Inbound Sources
1. **PO Receipts**: Supplier deliveries verified and accepted at dock receiving.
2. **Customer Sales Returns**: Returned products inspected and cleared for restocking.
3. **Internal Transfers**: Stock arriving from another company warehouse facility.
4. **Manufactured Assemblies**: Finished goods completed on manufacturing work orders.

### 2. Candidate Bin Selection
When an operator processes a putaway item:
* The system presents candidate storage bins in the destination warehouse.
* Operators can filter and select from active bins (`storage`, `pick`, `bulk`) where `is_unavailable = false`.
* Registering the putaway executes an atomic inventory movement: deducting units from the dock/staging bin and incrementing units in the selected destination storage bin.

---

## Step-by-Step Workflows

### 1. Executing a Putaway Task
1. Go to **Inventory** → **Putaway** (`/inventory/putaway`).
2. Review the list of items waiting in dock staging.
3. Click **Putaway** on a target line item.
4. Select the destination **Storage Bin** (or scan the bin barcode).
5. Confirm the **Putaway Quantity**.
6. Click **Confirm Putaway**. The stock is immediately available in the storage bin for order allocation and picking.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Product** | Item SKU and description being moved. |
| **Source Stream** | Inbound origin (`Purchase Receipt`, `Sales Return`, `Transfer`, `Work Order`). |
| **Quantity Staged** | Physical units residing at dock staging. |
| **Target Bin** | Selected storage coordinate (`Aisle-Rack-Shelf`). |
