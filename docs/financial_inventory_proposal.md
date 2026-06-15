# Financial Integration of Inventory Movements

## 1. Introduction: Inventory Accounting Models
There are two primary approaches to tracking the financial value of inventory in an ERP system. HeroBM currently employs the first, but we are proposing a configurable shift toward the second.

### Periodic Inventory Tracking (Current HeroBM Approach)
In this model, the system tracks the physical movement of goods (Quantity on Hand), but financial accounting is decoupled and simplified. Purchases are treated as immediate expenses.
*   **Pros:** Simpler to implement. Generates far fewer journal entries. Ideal for low-value consumables or service-based operations.
*   **Cons:** Zero real-time visibility into the actual value of inventory sitting on the balance sheet. Cost of Goods Sold (COGS) cannot be matched to specific sales in real-time, masking true gross margins. Financial valuation requires a manual physical stock-take at month-end.

### Perpetual Inventory Tracking (Proposed ERP Standard)
In this model, every physical movement of goods is strictly mirrored by a financial journal entry in real-time. Inventory is treated as an **Asset** on the balance sheet until the moment it is sold.
*   **Pros:** Real-time visibility into inventory asset value and gross margins. Accurate matching of revenues with COGS (GAAP matching principle). Precise tracking of variances (e.g., when a supplier invoices a different amount than the PO price).
*   **Cons:** More complex to build. Generates a high volume of automated journal entries. Requires strict discipline in warehouse operations, as a physical error immediately impacts the financial ledger.

### Configuration Switch
**Can the two be separated by a configuration option?**
Yes. We will introduce `appSettings.inventoryAccountingMode` with values `'periodic' | 'perpetual'`. 
*   If `periodic` (default fallback): Goods receiving and shipping do not generate GL entries. Purchase invoices directly debit an Expense account.
*   If `perpetual`: Goods receiving, shipping, and adjustments generate the automated GL entries outlined below. Purchase invoices clear the GRNI liability rather than hitting an expense account.

## 2. Financial Concept: Perpetual Inventory Flow
In a perpetual system, the flow looks like this:

1. **Receipt (Putaway)**: When goods enter the warehouse, you gain a physical asset. The financial equivalent is debiting an **Inventory Asset** account on the Balance Sheet. Because you haven't received the supplier's invoice yet, you credit a liability account called **Goods Received Not Invoiced (GRNI)** or Accrued Purchases.
2. **Purchase Invoice**: When the bill arrives, you don't expense it. Instead, you clear the liability by debiting **GRNI** and crediting **Accounts Payable (AP)**.
3. **Dispatch (Shipping)**: When goods are shipped to a customer, the physical asset leaves the warehouse. Financially, you credit the **Inventory Asset** account. At the exact same time, you recognize the cost of that sale by debiting the **Cost of Goods Sold (COGS)** expense account on the P&L.

### Valuation Strategy: Weighted Average vs. Standard Costing
When inventory moves in or out, we must assign it a monetary value. HeroBM's `appSettings` currently defaults to `weighted_average`. Here is the difference:

*   **Weighted Average Cost (WAC)**: The cost of an item is mathematically recalculated every time a new shipment is received. 
    *   *Example:* You have 10 units valued at $10 each. You receive 10 more at $12 each. The new WAC is $11. When you ship, you debit COGS for $11.
    *   *Pros:* Smooths out price fluctuations over time. Reflects actual purchasing costs accurately.
*   **Standard Costing**: The cost of an item is fixed manually by the finance team for a set period (e.g., a year). 
    *   *Example:* Standard Cost is set to $10. You receive 10 units at $12. Inventory is valued strictly at $10. The extra $2 per unit is immediately expensed to a "Purchase Price Variance" account.
    *   *Pros:* Predictable margins for sales teams. Highlights purchasing inefficiencies immediately.

*(HeroBM's `valuation.ts` utility currently supports both, so this is fully supported under the new perpetual flow).*

### 2.1 Explicit Stock Actions with Financial Implications
To ensure there are no partially applied accounting changes, the implementation must comprehensively cover every boundary where stock enters or leaves the system ledger. 

The following actions have **strict financial implications** under Perpetual tracking:

1. **Goods Receipt (from Supplier)**: *Increases total QOH.*
   - **Action**: Debit Inventory Asset, Credit Goods Received Not Invoiced (GRNI).
2. **Goods Dispatch (to Customer)**: *Decreases total QOH.*
   - **Action**: Debit Cost of Goods Sold (COGS), Credit Inventory Asset.
3. **Positive Inventory Adjustment (Cycle Count/Discrepancy)**: *Increases total QOH.*
   - **Action**: Debit Inventory Asset, Credit Inventory Shrinkage/Adjustment Expense.
4. **Negative Inventory Adjustment (Cycle Count/Discrepancy)**: *Decreases total QOH.*
   - **Action**: Debit Inventory Shrinkage/Adjustment Expense, Credit Inventory Asset.
5. **Sales Return Receipt (from Customer)**: *Increases total QOH.*
   - **Action**: Debit Inventory Asset, Credit COGS (Reversal of cost).
6. **Supplier Return Dispatch (to Supplier)**: *Decreases total QOH.*
   - **Action**: Debit GRNI, Credit Inventory Asset.

**Important Note on Internal Transfers:**
- **Bin-to-Bin / Internal Warehouse Movements**: These strictly move stock within the same facility and do not alter the total quantity on hand for the legal entity. They have **no financial implications** and will not generate GL journal entries.

## 3. State Comparison: HeroBM Perpetual vs HeroBM Periodic

| Event | Physical Inventory | Financial Impact (HeroBM Perpetual) | Financial Impact (HeroBM Periodic) |
| :--- | :--- | :--- | :--- |
| **1. Goods Receipt** | +QOH | **Debit:** Inventory Asset<br>**Credit:** GRNI Liability | **None.** |
| **2. Purchase Invoice** | None | **Debit:** GRNI (Clears liability)<br>**Credit:** Accounts Payable (AP) | **Debit:** Expense (Direct to P&L)*<br>**Credit:** Accounts Payable (AP) |
| **3. Goods Dispatch** | -QOH | **Debit:** Cost of Goods Sold (COGS)<br>**Credit:** Inventory Asset | **None.** |
| **4. Sales Invoice** | None | **Debit:** Accounts Receivable (AR)<br>**Credit:** Revenue | **Debit:** Accounts Receivable (AR)<br>**Credit:** Revenue |
| **5. Discrepancy / Adj.** | +/- QOH | **Debit/Credit:** Inventory Asset<br>**Debit/Credit:** Inventory Shrinkage Exp. | **None.** |

---

## 4. Execution Plan

### Database Schema Updates
Add the required GL accounts to the configuration schema.

#### [MODIFY] herobm-core-schema.ts
- Expand `glSettings` table to include:
  - `defaultInventoryAccountId`
  - `defaultGrniAccountId`
  - `defaultShrinkageAccountId`
- Expand `appSettings` table to include:
  - `inventoryAccountingMode` (Enum: `periodic` | `perpetual`, default `periodic`)

---

### System Setup (Wizard & CLI)
The initial setup processes must be expanded to prompt the user to make this configuration choice during installation.

#### [MODIFY] apps/api/src/setup/setup.dto.ts & setup.service.ts
- Add `inventoryAccountingMode` to the `SetupDto` validation schema.
- Map this value into the `app_settings` insertion during `SetupService.execute()`.

#### [MODIFY] apps/api/src/scripts/execute-setup.ts
- Add a CLI prompt (using `node:readline/promises`) to ask the user to select between Periodic and Perpetual tracking.
- Pass the selection into the setup payload.

#### [MODIFY] apps/ops-portal/app/setup/components/SetupWizard.tsx
- Add a new radio group in the "Accounting Defaults" or "Application Settings" step.
- Present the choice clearly: "Periodic Tracking (Simplified)" vs "Perpetual Tracking (ERP Standard)".
- Pass the chosen value to the API.

---

### Core Inventory Services
Move GL updates into the transactional boundaries of the core services when `perpetual` mode is active.

#### [MODIFY] inventory.service.ts
- Update `recordInventoryMovement` to check `appSettings.inventoryAccountingMode`.
- If `perpetual`, dynamically call `GlService.postJournalEntry(tx, ...)` when recording a discrepancy (Adjustment).
- Value the adjustment using `valuation.ts`.
- Debit/Credit the `defaultInventoryAccountId` vs. `defaultShrinkageAccountId`.

#### [MODIFY] goods-received.service.ts
- Update `putaway` logic to check `appSettings`.
- If `perpetual`, call `GlService.postJournalEntry(tx, ...)` upon successful putaway.
- Debit `defaultInventoryAccountId` and Credit `defaultGrniAccountId` using the PO line's price and `valuation.ts`.

---

### Order & Invoice Services
Update dispatching and purchasing to reflect perpetual inventory standard flow.

#### [MODIFY] shipment-write.service.ts
- Update `dispatchShipment` to check `appSettings`.
- If `perpetual`, call `GlService.postJournalEntry(tx, ...)` immediately.
- Use `valuation.ts` to calculate COGS based on the shipped quantity.
- Debit `defaultCogsAccountId` and Credit `defaultInventoryAccountId`.

#### [MODIFY] purchase-invoice.service.ts
- Update `postInvoice` to check `appSettings`.
- If `perpetual`, and the line item is an inventory product, Debit `defaultGrniAccountId` instead of directly expensing it to the P&L.
- Calculate Purchase Price Variance via `valuation.ts` if the invoice price differs from the receipt cost.

---

### Shared / Common Definitions
Standardize event naming to ensure audit logs and external integrations are consistent.

#### [MODIFY] event-types.ts
Rename inconsistent events to a unified domain verb pattern:
- `INVENTORY_ENTRY_CREATED` -> `STOCK_ADJUSTED` (or split into `STOCK_RECEIVED`, `STOCK_ADJUSTED`, `STOCK_RETURNED` depending on context).
- `GOODS_DISPATCHED` -> `STOCK_DISPATCHED`.
- Update `outbox` references and related service emissions to match.
