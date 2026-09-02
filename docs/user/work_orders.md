---
id: work-orders
title: "Work Orders & Assemblies"
description: "Manage light manufacturing, Bill of Materials (BOM) disassembly, component reservations, assembly costing, and finished goods creation."
category: "Manufacturing"
order: 21
resource: "work-orders"
action: "read"
routes:
  - "/manufacturing/work-orders"
  - "/manufacturing/work-orders/new"
  - "/manufacturing/work-orders/:id"
tags: ["work-orders", "manufacturing", "bom", "assembly", "wip", "costing", "production"]
fields:
  order_number:
    title: "Work Order Number"
    summary: "Unique production job identifier (e.g. WO-2026-00032)."
  product_id:
    title: "Assembly Product"
    summary: "Finished manufactured item to be produced."
  target_quantity:
    title: "Target Build Quantity"
    summary: "Planned number of finished units to assemble."
  status:
    title: "Work Order Status"
    summary: "Production state (Draft, Planned, In-Progress, Completed, Cancelled)."
  assembly_cost_per_unit:
    title: "Assembly Cost / Unit"
    summary: "Direct variable labor and machining cost per assembled finished unit."
  additional_cost:
    title: "Additional Cost"
    summary: "Fixed lump-sum overhead, machine setup, or subcontracting charge."
  total_cost:
    title: "Total Work Order Cost"
    summary: "Total production cost: component materials + (unit assembly cost * target quantity) + additional cost."
related:
  - "products"
  - "inventory-management"
  - "putaway"
  - "purchase-demands"
---

# Work Orders & Assemblies

The **Work Orders & Assemblies** module manages light assembly, kit building, and manufacturing. It decomposes multi-component Bills of Materials (BOM), allocates raw material parts, tracks work-in-progress (WIP), and calculates finished goods unit costs.

---

## Work Order Lifecycle & Costing

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Work Order
    Draft --> Planned : Plan / Allocate Components
    Draft --> Cancelled : Cancel

    Planned --> InProgress : Start Assembly (Issue Components to WIP)
    Planned --> Cancelled : Cancel (Release Component Reservations)

    InProgress --> Completed : Finish Assembly (Stock Finished Units)
    InProgress --> Cancelled : Abort Assembly (Return Unused Components)

    Completed --> [*]
```

### 1. Work Order States & Progression
* **`Draft`**: Production job created, target assembly selected, and component requirements calculated from BOM.
* **`Planned`**: Components checked and reserved from warehouse storage bins. Shortages enter the Purchase Demands queue.
* **`In-Progress`**: Production underway. Component stock is physically issued from bins to Work-In-Progress (`wip` bin).
* **`Completed`**: Finished goods verified, unit cost calculated, finished items moved to Putaway staging, and work order closed.
* **`Cancelled`**: Job cancelled; reserved or issued components returned to storage.

### 2. Live Assembly Costing & Valuation
When completing a build (`completeBuild`), the system calculates total job costs and finished inventory valuation:

```
Component Materials Cost = Sum(Component Expected Quantity * Component Unit Cost)
Total Assembly Labor Cost = Assembly Cost Per Unit * Target Quantity
Total Work Order Cost = Component Materials Cost + Total Assembly Labor Cost + Additional Cost
Finished Product Unit Cost = Total Work Order Cost / Target Quantity
```

* **Component Materials Cost**: Calculated from the snapshotted Bill of Materials components (`work_order_components`) based on expected quantities and their unit cost / Moving WAC.
* **Assembly Cost Per Unit (`assemblyCostPerUnit`)**: Variable direct labor or machine running cost entered per finished unit.
* **Additional Cost (`additionalCost`)**: Fixed lump-sum overhead, machine setup fee, or subcontracting charge for the overall build.
* **Inventory Capitalization**: Completing the build capitalizes the finished products into warehouse inventory at the new `Finished Product Unit Cost`, while crediting the consumed raw materials.

---

## Step-by-Step Workflows

### 1. Creating and Executing a Work Order
1. Go to **Manufacturing** → **Work Orders** (`/manufacturing/work-orders`).
2. Click **New Work Order** (`/manufacturing/work-orders/new`).
3. Select the **Assembly Product** and enter the **Target Build Quantity**.
4. The system snapshots component requirements from the active Bill of Materials into `work_order_components`.
5. Enter any **Unit Assembly Cost** (labor per unit) and **Additional Cost** (setup/overhead).
6. Click **Plan Work Order** to verify and reserve component stock.
7. When assembly begins, click **Start Assembly** to issue components to WIP.
8. Upon completion, verify output quantities and click **Complete Work Order**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Work Order Number** | Production identifier (`WO-...`). |
| **Assembly Product** | Finished item being manufactured. |
| **Target Build Quantity** | Planned assembly count. |
| **Components** | List of raw materials and sub-assemblies required with unit costs. |
| **Assembly Cost / Unit** | Direct variable labor and machine cost per assembled unit (`assemblyCostPerUnit`). |
| **Additional Cost** | Fixed lump-sum setup or overhead fee (`additionalCost`). |
| **Total Cost** | Total build cost (`components + assembly labor + additional cost`). |
| **Status** | Stage (`Draft`, `Planned`, `In-Progress`, `Completed`, `Cancelled`). |
