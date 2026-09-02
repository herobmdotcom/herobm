---
id: sales-returns
title: "Sales Returns & RMA"
description: "Process Return Merchandise Authorizations (RMA), receive customer returns at the dock, inspect goods, and issue Credit Notes."
category: "Sales"
order: 10
resource: "sales-returns"
action: "read"
routes:
  - "/sales-returns"
  - "/sales-returns/new"
  - "/sales-returns/:id"
tags: ["sales-returns", "rma", "credit-notes", "returns", "restocking", "inspections", "customers"]
fields:
  return_number:
    title: "Return Number (RMA)"
    summary: "Unique Return Merchandise Authorization identifier (e.g. RMA-2026-00021)."
  sales_order_id:
    title: "Originating Sales Order"
    summary: "Customer sales order against which items are being returned."
  customer_id:
    title: "Customer Account"
    summary: "Debtor account returning products."
  state_code:
    title: "RMA Status"
    summary: "Return status (Draft, Confirmed, Partially Received, Received, Processed, Cancelled)."
  restock_action:
    title: "Restock Destination"
    summary: "Restock into active storage bins, route to quarantine for inspection, or scrap."
related:
  - "sales-orders"
  - "sales-credit-notes"
  - "receiving"
  - "transfers-quarantine"
---

# Sales Returns & RMA

The **Sales Returns** module manages customer returns, warranty claims, dock receipts for returned goods, quality inspections, and credit note issuance.

---

## RMA Lifecycle & Business Logic

```mermaid
stateDiagram-v2
    [*] --> Draft : Create RMA
    Draft --> Confirmed : Authorize RMA / Issue RMA Number
    Draft --> Cancelled : Cancel

    Confirmed --> PartiallyReceived : Partial Goods Arrival at Dock
    Confirmed --> Received : 100% Goods Arrived
    Confirmed --> Cancelled : Customer Cancelled Return

    PartiallyReceived --> Received : Remaining Units Arrive
    PartiallyReceived --> Processed : Issue Credit Note for Partial
    
    Received --> Processed : Restock & Issue Credit Note
    
    Processed --> [*]
```

### 1. RMA States & Progression
* **`Draft`**: Return request created with customer and proposed items.
* **`Confirmed`**: Return authorized and official RMA document sent to customer.
* **`Partially Received` / `Received`**: Customer packages arrive at the warehouse dock and are verified against the RMA.
* **`Processed`**: Goods inspected, restocked/quarantined, and compensating Credit Note issued.
* **`Cancelled`**: Return aborted.

### 2. Dock Disposition & Restocking
When receiving returned items:
* **Sound Items**: Accepted back into inventory and routed to the Putaway queue to return to active storage bins.
* **Damaged / Faulty Items**: Routed directly into a `quarantine` bin for manufacturer warranty inspection or scrap write-off.
* **Credit Note Generation**: Clicking **Generate Credit Note** creates a linked draft Credit Note matching the accepted returned quantities and pricing.

---

## Step-by-Step Workflows

### 1. Authorizing a Customer Return (RMA)
1. Go to **Sales** → **Returns** (`/sales-returns`).
2. Click **New Return** (`/sales-returns/new`).
3. Select the originating **Sales Order** and **Customer**.
4. Choose the return lines, quantities, and return reason (e.g. Defective, Wrong Size, Customer Changed Mind).
5. Click **Confirm Return** to generate the official RMA document and email it to the customer.

### 2. Receiving and Crediting the Return
1. When the package arrives at the dock, open the RMA record.
2. Click **Receive Items** and enter verified counts.
3. Select the disposition: **Restock to Inventory** or **Move to Quarantine**.
4. Click **Generate Credit Note** to issue the Accounts Receivable credit note to the customer.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Return Number (RMA)** | System authorization identifier (`RMA-...`). |
| **Sales Order** | Originating sales order reference (`ORD-...`). |
| **Customer** | Account returning merchandise. |
| **Return Status** | Stage (`Draft`, `Confirmed`, `Partially Received`, `Received`, `Processed`, `Cancelled`). |
| **Return Reason** | Commercial cause (Defective, Damaged, Transit Loss, Unwanted). |
