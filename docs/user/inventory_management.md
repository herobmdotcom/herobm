---
id: inventory
title: "Inventory & Stock Ledger"
description: "Track warehouse bin contents, perpetual stock ledger movements, physical counts, and location balances."
category: "Inventory"
order: 10
resource: "inventory"
action: "read"
routes:
  - "/inventory/bins"
  - "/inventory/ledger"
  - "/inventory/locations"
tags: ["inventory", "stock", "bins", "ledger", "locations", "counts", "adjustments"]
fields:
  location_id:
    title: "Warehouse Location"
    summary: "Physical warehouse building or site (e.g. Main Warehouse, Transit Depot)."
  bin_code:
    title: "Storage Bin"
    summary: "Specific shelf, rack, or aisle storage coordinate (e.g. A-04-B2)."
  quantity_on_hand:
    title: "On Hand (OH)"
    summary: "Total physical stock physically present in the warehouse."
  quantity_committed:
    title: "Committed"
    summary: "Stock allocated to confirmed customer orders and pick lists."
  quantity_available:
    title: "Available (Avail)"
    summary: "Stock free for new orders (`On Hand - Committed - Reserved`)."
  movement_type:
    title: "Movement Type"
    summary: "Ledger transaction type: RECEIPT, PICK, SHIPMENT, TRANSFER, or ADJUSTMENT."
related:
  - "products"
  - "transfers-quarantine"
  - "receiving"
  - "picking"
  - "shipping"
---

# Inventory & Stock Ledger

The **Inventory** module tracks stock levels in real time across warehouse facilities, storage bins, and perpetual ledger transactions.

---

## Inventory Calculations & Ledger Rules

### 1. The Stock Balance Equation
For any product and location, stock availability is computed in real time:

$$\text{Available Stock} = \text{On Hand} - \text{Committed} - \text{Reserved}$$

- **On Hand**: Physical items present in the building.
- **Committed**: Items allocated to confirmed sales orders awaiting picking or dispatch.
- **Reserved**: Items held for quarantine inspection or production work orders.
- **Available**: Free stock that can be sold to new customer orders.

### 2. Perpetual Stock Ledger
Every physical movement generates an immutable transaction in the Stock Ledger:
- **`RECEIPT`**: Inbound goods from suppliers or customer returns increase on-hand counts.
- **`PICK`**: Moving items to pick carts flags stock as committed.
- **`DISPATCH`**: Shipments decrease on-hand and committed counts.
- **`TRANSFER`**: Moving stock between bins or warehouses.
- **`ADJUSTMENT`**: Stock take count corrections or write-offs.

---

## Step-by-Step Workflows

### 1. Checking Bin Contents
1. Go to **Inventory** → **Inventory** → **Bin Contents** (`/inventory/bins`).
2. Search by product SKU, name, or bin location.
3. View the live breakdown of On-Hand, Committed, and Available quantities.

### 2. Performing a Manual Stock Adjustment
1. Go to **Inventory** → **Stock Ledger** (`/inventory/ledger`).
2. Click **+ Stock Adjustment**.
3. Select the **Warehouse**, **Bin**, and **Product**.
4. Enter the count difference (+/- quantity) and select an **Adjustment Reason** (e.g. Stocktake Variance, Damaged Goods).
5. Click **Post Adjustment** to update stock counts and post an inventory revaluation to the General Ledger.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Warehouse Location** | Warehouse facility or storage site. |
| **Bin Coordinate** | Aisle, rack, and shelf location. |
| **On Hand** | Total physical quantity in stock. |
| **Committed** | Quantity reserved for open orders. |
| **Available** | Quantity free to sell. |
| **Movement Type** | Transaction category in the stock ledger. |
