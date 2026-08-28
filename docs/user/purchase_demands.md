---
id: purchase-demands
title: "Purchase Demands & Reordering"
description: "Review automated stock shortage triggers, backorder requirements, and consolidate demands into Purchase Orders."
category: "Purchasing"
order: 17
resource: "orders"
action: "read"
routes:
  - "/purchase-orders/demands"
tags: ["demand", "purchasing", "backorders", "reorder", "procurement", "planning", "pegging"]
fields:
  product_id:
    title: "Product"
    summary: "Item requiring replenishment in the warehouse."
  quantity:
    title: "Required Quantity"
    summary: "Shortage quantity needed to restore safety stock or satisfy open backorders."
  sales_order_id:
    title: "Source Sales Order"
    summary: "Sales order whose confirmation generated the linked backorder demand."
  vendor_id:
    title: "Preferred Supplier"
    summary: "Primary vendor mapped on the product card for consolidated purchase order generation."
  expected_unit_cost:
    title: "Expected Unit Cost"
    summary: "Agreed purchasing price from the supplier price list or last purchase cost."
related:
  - "purchase-orders"
  - "sales-orders"
  - "suppliers"
  - "inventory"
---

# Purchase Demands & Reordering

The **Purchase Demands** queue consolidates all stock replenishment requirements across the enterprise — unifying customer sales order backorders and automated reorder point deficits.

---

## Demand Generation & Reordering Logic

```mermaid
flowchart TD
    A[Sales Order Confirmed with Stock Gap] --> C[Purchase Demand Queue]
    B[Net Stock Falls Below Reorder Point] --> C
    C --> D[Consolidate by Preferred Supplier & MOQ]
    D --> E[Click Generate Purchase Orders]
    E --> F[Create Vendor-Grouped Draft POs]
```

### 1. Net Inventory Position & Shortage Triggers
The system evaluates stock replenishment using the enterprise net position formula:

```
Net Available Stock = Available On-Hand + On-Order (Open POs) - Allocated Reservations - Quarantine
```

* **Shortage Condition**: A replenishment demand is triggered whenever:
  ```
  Net Available Stock < Reorder Point (Safety Stock Level)
  ```
* **Suggested Order Quantity**:
  ```
  Suggested PO Quantity = max(Max Stock Level - Net Available Stock, Vendor Minimum Order Quantity)
  ```
  If the vendor specifies a **Purchasing Pack Size** (e.g. box of 25), the suggested quantity automatically rounds up to the nearest multiple.

### 2. Backorder Pegging & Cross-Docking
* When confirming a customer Sales Order with an inventory gap, selecting **Generate Backorders** creates a demand record with direct relational pointers to the `sales_order_id` and `sales_order_line_id`.
* When the resulting Purchase Order is received at the dock, warehouse operators receive an immediate **Backorder Cross-Dock Prompt**, allowing goods to be routed directly to the staging area for immediate customer dispatch.

### 3. Supplier Consolidation Algorithm
* Demands across multiple products are automatically aggregated by **Preferred Supplier**.
* Sourcing data (Supplier SKU, purchasing currency, standard lead time, and contracted unit price) is pulled automatically from supplier catalogs to build complete draft Purchase Orders with a single click.

---

## Step-by-Step Workflows

### 1. Generating Purchase Orders from Demands
1. Go to **Purchasing** → **Demand** (`/purchase-orders/demands`).
2. Review the consolidated shortage list. Filter by warehouse facility or preferred supplier.
3. Select the check-boxes for the lines you wish to purchase.
4. Click **Generate Purchase Orders**.
5. The system creates draft Purchase Orders grouped by vendor, automatically populating vendor costs and quantities.
6. Open the generated draft Purchase Orders (`/purchase-orders`) to review and send to suppliers.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Product** | Replenishment item requiring stock. |
| **Required Quantity** | Calculated units needed to satisfy backorders or reach max stock. |
| **Source Sales Order** | Linked customer order number for direct backorder pegging. |
| **Preferred Supplier** | Default vendor configured on the product record. |
| **Expected Unit Cost** | Contracted unit purchase price in supplier currency. |

