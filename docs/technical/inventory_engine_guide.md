# ModBM Core Inventory Engine Guide

This document describes the design, architecture, and core mutation pathways of the new ModBM Inventory Engine. The engine is built on a double-entry ledger architecture, ensuring high-fidelity traceability for every physical movement of stock.

> [!IMPORTANT]
> The legacy `mart_inventory` and `commitStock`/`releaseStock` paradigms have been entirely removed. **All** inventory movements must be recorded via double-entry ledger lines.

## Double-Entry Ledger Architecture

The core tenet of the ModBM inventory engine is that stock never "appears" or "disappears"—it only moves between states or bins. 

The ledger consists of two primary tables:
1.  **`inventory_entries`**: Header table tracking the transaction metadata (date, user, source document, generic memo). Use this table to understand *why* a movement occurred.
2.  **`inventory_ledger`**: Line-item table storing the actual stock movements. A single `entry` contains multiple `ledger` rows (usually balancing to a net-zero physical change if moving within the warehouse, or representing absolute in/out flows if moving to/from the external world like suppliers or customers).

### Core Mutation Method

All writes must go through `InventoryService.recordInventoryMovement`. This method ensures atomic, consistent writes:

```typescript
// Example: Creating a ledger movement
await inventoryService.recordInventoryMovement(tx, {
  entryNumber: 'MV-001',
  sourceType: 'SO_PICK',
  sourceId: 'order-1234',
  userId: 'admin',
  memo: 'Picking allocation',
  lines: [
    { productId: 'P1', binId: 'bin-b1', locationNo: 'L1', quantity: -10 },
    { productId: 'P1', binId: 'bin-shipping', locationNo: 'L1', quantity: 10 }
  ]
});
```

The method does three things in the same transaction:
1.  Inserts the `inventory_entries` header.
2.  Inserts the `inventory_ledger` lines (converting numeric quantities to string literals to prevent precision loss in JS).
3.  Emits an `INVENTORY_ENTRY_CREATED` event to the outbox for external listeners (e.g., Elasticsearch indexing, analytical syncs).

## Valuation Cache (`quantityOnHand`)

While the ledger stores immutable facts about stock movement, doing a `SUM()` over millions of rows on every API request is too slow. ModBM uses a **Valuation Cache** pattern on the `products` table.

> [!NOTE]
> The `quantityOnHand` column on the `products` table is a **cache**. It is only updated on goods receipt/return events for the purpose of Standard Cost and Weighted Average Cost (WAC) calculations.

### Why Not Just Compute WAC From Ledger? 

During a Purchase Order Receipt (`PO_RECEIPT`), the system must immediately recalculate the WAC to accurately value the stock that just entered the warehouse.
The formula is:
```text
New WAC = [(Old Qty * Old WAC) + (Receipt Qty * Receipt Unit Cost)] / (Old Qty + Receipt Qty)
```

The `Old Qty` needs to be fetched instantaneously within the same database transaction. The `products.quantityOnHand` counter acts as this instant lookup.

## Fulfillment Lifecycle (Sales Orders)

The fulfillment flow moves stock from storage bins, through location-specific staging bins, out to the customer.

1.  **Allocate (Picking)**:
    When a user picks a Sales Order line, `PickingService.allocatePickDelta` determines where to pull stock from. It prioritizes bins with available stock in the order's location, falling back to a default bin if none are available.
    *   **Ledger Lines**: `-Qty` from `Source Bin`, `+Qty` to `SHIPPING` bin (resolved dynamically for the specific location).
2.  **Pack**:
    The system currently merges picking and packing logic. Stock resides in the location's `SHIPPING` bin.
3.  **Dispatch (Shipping)**:
    When a shipment state becomes `dispatched`, `ShipmentService` issues a final stock movement.
    *   **Ledger Lines**: `-Qty` from the location's `SHIPPING` bin. (No balancing positive line, as the stock has left the warehouse perimeter).

### Bin Allocation Logic

`PickingService.allocatePickDelta` implements a FIFO-like allocation to fulfill a request:
1.  Find all bins containing the product within the source location (excluding the staging bins like `SHIPPING` or `RECEIVING`).
2.  Iterate through bins, pulling stock until the requested delta is fulfilled.
3.  If all valid bins run dry, pull the remainder from a system **fallback bin** (preventing blocking errors during edge-case inventory desyncs).
4.  If the delta is negative (e.g., a picker "un-picks"), return stock from the location's `SHIPPING` bin to the fallback bin for manual put-away.

## Common Operations

### Read: Current Stock Levels
To read total stock levels per product and location, use the PostgreSQL View `modbm_core.inventory_levels`. This view automatically aggregates the `inventory_ledger` grouping by `product_id` and `location_no`, extracting `quantityCommitted` and `quantityReserved`.

> [!IMPORTANT]
> **Shared Inventory Functions**
> The database view DOES NOT evaluate the final `Available` metric. By design, you must never write raw SQL queries relying on `available > 0` directly. Instead, any backend logic or frontend component MUST import and use the `@modbm/shared` library:
> ```typescript
> import { calculateAvailableQuantity } from '@modbm/shared';
> 
> const available = calculateAvailableQuantity(onHand, committed, reserved);
> ```
> This guarantees structural parity between the API mappings and Client UI calculations.

### Read: Bin Contents
To see exactly what stock is in what bin, use the `InventoryService.findBins` method which queries the `modbm_core.bin_contents` view.

## Testing Strategy
The inventory engine is validated by comprehensive test suites:
1.  **Unit Tests**: Isolated testing of calculation functions (like `allocatePickDelta` bin logic, outbox event generation).
2.  **E2E Tests**: Found in `test/picking.e2e-spec.ts` and `test/purchase-orders.e2e-spec.ts`, these simulate the entire flow and run direct `SELECT * FROM inventory_entries` database assertions to ensure physical ledger lines are created properly.
