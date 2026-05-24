# Shared Packages (`@modbm/shared`)

This package contains shared utilities and logic. The following rules govern their usage:


## Shared Order Helpers

Order-related services (`orders-write`, `returns-write`, `shipment`, `picking`) must import shared utilities from `apps/api/src/orders/shipment-helpers.ts`:

| Function | Purpose | `aggregateType` param |
|---|---|---|
| `writeEvent()` | Audit event + outbox record | defaults to `'sales_order'`, pass `'sales_order_return'` or `'sales_order_shipment'` as needed |
| `findOrder()` | Lookup-or-throw for sales orders | — |
| `findOrderLine()` | Lookup-or-throw for line items (validates ownership) | — |

Do **not** duplicate these functions in new services.

## Shared State Machines (`@modbm/shared`)

All entity state transition maps (Sales Orders, Purchase Orders, Shipments, Returns) live in the `@modbm/shared` package (`packages/shared/src/state-machines.ts`). Both the API (NestJS) and the portal UI (Next.js) import from this single source of truth.

- **Do NOT** duplicate transition maps, lifecycle ordinals, or helper functions (e.g., `isBackTransition`, `cap`) in consumer code.
- **Mandate:** Every `changeState` endpoint in the API **must** validate against its transition map from `@modbm/shared`. Accepting arbitrary state strings is forbidden.
- **New entities:** If a new entity needs state management, add its transition map and lifecycle ordinal to `@modbm/shared` first, then import it in the consumer.

**Enforced by:** `infra/tests/test_no_duplicated_state_machines.ps1`

## Shared Line Pricing (`@modbm/shared`)

All line-amount calculations (order lines, invoice lines, purchase order lines) **must** use `computeLinePrice()` or `computeLinePriceForStorage()` from `@modbm/shared` (`packages/shared/src/pricing.ts`).

The formula `qty × price × (1 − discount/100)` must exist in **exactly one place** in the system. Do not inline arithmetic like `qty * price * (1 - disc / 100)` in services, controllers, or frontend components.

```typescript
// ✅ Correct — use the shared function
import { computeLinePrice } from '@modbm/shared';

const pricing = computeLinePrice({
  quantity: 10,
  pricePerUnit: 25.00,
  discountPercentage: 5,
  taxRate: 9,                       // ← percentage, NOT dollar amount
});
// → { amount: 237.50, tax: 21.375, totalAmount: 258.875 }
```

```typescript
// ❌ Wrong — inline formula will diverge and create bugs
const amount = qty * price * (1 - disc / 100);
const tax = amount * (taxRate / 100);
```

> [!IMPORTANT]
> The `taxRate` parameter must be the **percentage rate** (e.g. `9` for 9% GST), resolved from the GST category. Never pass the stored `line.tax` field — that holds a **dollar amount**, not a rate.

**Enforced by:** `infra/tests/test_no_inline_pricing.ps1`

## Shared Inventory Calculations (`@modbm/shared`)

All inventory availability calculations **must** use `calculateAvailableQuantity()` from `@modbm/shared` (`packages/shared/src/inventory.ts`).

The formula `Available = On Hand - Committed - Reserved` must exist in **exactly one place** in the system. Do not inline arithmetic like `quantityOnHand - quantityCommitted` inside Drizzle SQL queries, backend services, or frontend React components.

```typescript
// ✅ Correct — use the shared function for mapping the final value
import { calculateAvailableQuantity } from '@modbm/shared';

const available = calculateAvailableQuantity(row.quantityOnHand, row.quantityCommitted, row.quantityReserved);
```

```typescript
// ❌ Wrong — inline SQL calculation will diverge and create bugs
const quantityAvailable = sql<number>`(${inventoryLevels.quantityOnHand} - ${inventoryLevels.quantityCommitted})`;
```

**Enforced by:** `infra/tests/test_no_inline_inventory_math.ps1`

---

