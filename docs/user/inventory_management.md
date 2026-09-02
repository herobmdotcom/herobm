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
tags: ["inventory", "stock", "bins", "ledger", "locations", "counts", "adjustments", "valuation", "wac"]
fields:
  location_id:
    title: "Warehouse Location"
    summary: "Physical warehouse building or site (e.g. Main Warehouse, Transit Depot)."
  bin_code:
    title: "Storage Bin"
    summary: "Specific shelf, rack, or aisle coordinate (e.g. A-04-B2)."
  bin_type:
    title: "Bin Type"
    summary: "Storage classification (storage, pick, bulk, staging, quarantine, in_transit, wip)."
  quantity_on_hand:
    title: "On Hand (OH)"
    summary: "Total physical units physically present in the warehouse facility."
  quantity_committed:
    title: "Committed"
    summary: "Stock allocated to confirmed customer orders and active picking queues."
  quantity_available:
    title: "Available (Avail)"
    summary: "Stock free for new customer orders (Pickable Bins minus Committed stock)."
  movement_type:
    title: "Movement Type"
    summary: "Ledger transaction type: INITIAL_IMPORT, PO_RECEIPT, SO_SHIPMENT, RETURN, ADJUSTMENT, TRANSFER."
related:
  - "products"
  - "transfers-quarantine"
  - "receiving"
  - "picking"
  - "shipping"
---

# Inventory & Stock Ledger

The **Inventory** module tracks perpetual stock levels across warehouse locations, individual storage bins, valuation ledgers, and physical count adjustments.

---

## Inventory Calculations & Valuation Rules

### 1. The Stock Availability Equation
Availability is calculated dynamically across warehouse storage bins using the canonical availability function:

```
Available Stock = On Hand - Committed Stock - Reserved Stock
```

* **Pickable Bin Whitelist**: Stock is only eligible for commercial allocation if the storage bin meets the pickability criteria:
  1. `bin_type` is `storage`, `pick`, or `bulk`.
  2. `is_unavailable = false` (bin is not locked or under maintenance).
  3. `is_bonded = false` (stock is cleared for commercial release).
* **Non-Pickable Bins**: Items in `quarantine`, `staging`, `in_transit`, or `wip` bins are visible in physical **On Hand** totals but are strictly **excluded from Available Stock**.
* **Committed Stock**: Units reserved for `Confirmed` sales orders, active picking lines, and open production work orders.

### 2. Perpetual Costing & Valuation Strategies

HeroBM supports two perpetual valuation models:

#### A. Moving Weighted Average Cost (WAC)
WAC is recalculated immediately whenever inbound goods are received at the dock:

```
New WAC = ((Current QOH * Current WAC) + (Qty Received * Actual Unit Cost)) / (Current QOH + Qty Received)
```

* Stored to **4 decimal places** to eliminate fractional rounding drift over high-volume transactions.
* **COGS at Dispatch**: When goods are shipped to clients, the financial ledger posts:
  ```
  Debit:  Cost of Goods Sold (COGS)  (Qty Shipped * Current WAC)
  Credit: Inventory Asset Account     (Qty Shipped * Current WAC)
  ```

#### B. Standard Costing & Purchase Price Variance (PPV)
When using Standard Costing, inventory is capitalized at standard cost regardless of the supplier purchase price:

```
Inventory Value Added = Qty Received * Standard Cost
Purchase Price Variance (PPV) = (Actual Unit Cost - Standard Cost) * Qty Received
```

* If `Actual Cost > Standard Cost`, the positive difference debits PPV expense.
* If `Actual Cost < Standard Cost`, the favorable variance credits PPV expense.

### 3. Stock Adjustments & GL Impact
Stock count corrections generate immutable entries in the Perpetual Stock Ledger and post directly to the General Ledger:

* **Positive Count Adjustment (Surplus Found)**:
  ```
  Debit:  Inventory Asset Account
  Credit: Stocktake Variance Gain / Expense
  ```
* **Negative Count Adjustment (Shrinkage / Damage / Scrap)**:
  ```
  Debit:  Inventory Shrinkage / Loss Expense
  Credit: Inventory Asset Account
  ```

---

## Step-by-Step Workflows

### 1. Checking Bin Contents and Availability
1. Go to **Inventory** → **Bin Contents** (`/inventory/bins`).
2. Filter by warehouse facility, SKU, or bin coordinate.
3. Review physical On Hand, Committed reservations, and free Available units.

### 2. Performing a Stock Adjustment
1. Go to **Inventory** → **Stock Ledger** (`/inventory/ledger`).
2. Click **Stock Adjustment**.
3. Select the **Warehouse**, **Storage Bin**, and **Product**.
4. Enter the count variance (+/- quantity) and select a mandatory **Adjustment Reason**.
5. Click **Post Adjustment**. Perpetual stock balances and GL inventory assets update immediately.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Warehouse Location** | Facility or site where stock is physically situated. |
| **Bin Coordinate** | Aisle, rack, and shelf storage location (e.g. `A-04-B2`). |
| **Bin Type** | Functional category (`storage`, `pick`, `bulk`, `staging`, `quarantine`, `in_transit`, `wip`). |
| **On Hand** | Total physical quantity residing in the facility. |
| **Committed** | Quantity reserved for open sales orders and work orders. |
| **Available** | Free stock in eligible pickable bins ready for new orders. |
| **Movement Type** | Transaction type in the perpetual ledger (`INITIAL_IMPORT`, `PO_RECEIPT`, `SO_SHIPMENT`, `RETURN`, `ADJUSTMENT`, `TRANSFER`). |
