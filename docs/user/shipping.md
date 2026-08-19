---
id: inventory-shipping
title: "Shipping & Outbound Logistics"
description: "Pack picked items, print carrier consignment labels, process supplier returns (RTV), and complete dispatch."
category: "Inventory"
order: 15
resource: "orders"
action: "read"
routes:
  - "/inventory/shipping"
  - "/shipments/returns"
tags: ["shipping", "logistics", "packing", "dispatch", "carriers", "rtv"]
fields:
  carrier_id:
    title: "Shipping Carrier"
    summary: "Transport provider (e.g. DHL, FedEx, UPS, Local Fleet)."
  package_weight:
    title: "Gross Weight"
    summary: "Total parcel weight for transport manifests."
  consignment_number:
    title: "Consignment / Waybill"
    summary: "Carrier tracking barcode and reference."
  shipping_notes:
    title: "Driver Instructions"
    summary: "Special delivery instructions (e.g. Tailgate required, Gate code)."
related:
  - "shipments"
  - "picking"
  - "sales-orders"
  - "purchase-returns"
---

# Shipping & Outbound Logistics

The **Shipping** desk is the final checkpoint before goods leave the facility. Operators pack picked orders into shipping cartons, print carrier labels, generate delivery dockets, and confirm final dispatch.

---

## Outbound Logistics Workflows

```mermaid
flowchart LR
    A[Picked Items Arrive at Pack Station] --> B[Verify Items & Pack Cartons]
    B --> C[Weigh & Measure Parcel]
    C --> D[Print Carrier Label & Packing Slip]
    D --> E[Hand Over to Carrier & Confirm Dispatch]
```

### 1. Customer Shipments vs Supplier Returns (RTV)
- **Customer Shipments**: Outbound customer orders fulfill sales demand.
- **Supplier Returns (RTV)**: Defective or rejected supplier stock is packed and returned to vendors via the **Supplier Returns** queue (`/shipments/returns`).

---

## Step-by-Step Workflows

### 1. Packing and Dispatching Customer Goods
1. Go to **Inventory** → **Shipping** → **Customer Shipments** (`/inventory/shipping`).
2. Select an order ready from the picking stage.
3. Verify line items packed into the carton.
4. Enter the **Package Weight** and select the **Carrier**.
5. Print the **Packing Slip** and affix the shipping label.
6. Click **Confirm Dispatch**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Carrier** | Assigned transport service. |
| **Gross Weight** | Total shipment weight in kg/lbs. |
| **Tracking Number** | Waybill tracking reference. |
| **Shipping Notes** | Special delivery instructions. |
