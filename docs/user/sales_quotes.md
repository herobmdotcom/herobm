---
id: sales-quotes
title: "Sales Quotes"
description: "Prepare customer price estimates, send branded PDF quotations, and convert quotes to Sales Orders."
category: "Sales"
order: 3
resource: "orders"
action: "read"
routes:
  - "/sales-quotes"
tags: ["quotes", "sales", "estimates", "pricing", "pdf", "conversions"]
fields:
  customer_id:
    title: "Customer"
    summary: "Target customer account. Automatically pre-fills currency, terms, addresses, and price scale (1–4)."
  quote_number:
    title: "Quote Number"
    summary: "Unique quote identifier (corresponds directly to the underlying Sales Order number)."
  currency_code:
    title: "Currency"
    summary: "Transaction currency for all quoted line items, inherited from the customer."
  line_items:
    title: "Line Items"
    summary: "Products, quantities, unit prices, discount matrix percentages, and tax rates."
related:
  - "customers"
  - "sales-orders"
  - "products"
---

# Sales Quotes

The **Sales Quotes** module allows sales representatives to prepare formal price proposals, inspect live warehouse stock availability, and issue branded PDF quotations. 

Sales Quotes are implemented directly as filtered views of Sales Orders in the `Draft` or `Quoted` state.

---

## Quote Lifecycle & Business Logic

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Quote (Draft Order)
    Draft --> Quoted : Issue Quote (Lock Terms)
    Draft --> Cancelled : Discard

    Quoted --> Confirmed : Customer Approves (Commit Stock)
    Quoted --> Draft : Revise Commercial Terms
    Quoted --> Cancelled : Customer Rejects
```

### 1. Underlying Architecture & Commercial Locking
* **Single Entity Pipeline**: A quote is a Sales Order in `Draft` or `Quoted` state. There is no duplicate record creation when converting to an order.
* **Pricing Freeze**: Moving to `Quoted` locks the price scale, line discount percentages, exchange rates, and tax categories to preserve the exact commercial agreement offered to the client.
* **Revision Workflow**: To modify quantities or pricing on a locked quote, click **Revise Quote** to return the record to `Draft`.

### 2. Stock Allocation vs. Availability Visibility
* **Draft & Quoted Visibility**: The quote screen displays live On Hand (OH) and Available (Avail) stock across all storage bins, but **does not reserve physical stock**.
* **Stock Commitment at Confirmation**: Physical inventory is strictly committed when an operator clicks **Confirm Order** (transitioning the record to `Confirmed`).
* **Inventory Gap Resolution**: If available stock is insufficient at the moment of confirmation:
  * **Generate Backorders**: Automatically creates demand entries in Purchasing pegged directly to the order.
  * **Acknowledge Discrepancy**: Confirms the order to allocate available stock immediately and manage shortages manually.

---

## Step-by-Step Workflows

### 1. Creating and Sending a Quotation
1. Go to **Sales** → **Sales Quotes** (`/sales-quotes`).
2. Click **New Quote** (creates a new order in `Draft`).
3. Select the **Customer**. Price scale, currency, and addresses fill automatically.
4. Add line items, quantities, unit prices, and discounts.
5. Click **Save as Draft**.
6. Click **Issue Quote** to lock terms, then click **PDF** or **Email** to transmit the quote to the customer.

### 2. Converting an Accepted Quote
1. Open the accepted quote from `/sales-quotes`.
2. Click **Confirm Order**.
3. The system performs real-time credit checks and stock reservation, transitioning the document into a live confirmed Sales Order for fulfillment.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Customer** | Customer account receiving the quotation. |
| **Quote Number** | Unique quote identifier (matches Sales Order number). |
| **Currency** | Transaction currency for all quoted prices and totals. |
| **Price Scale** | Default pricing scale (1–4) used for product list prices. |
| **Total Amount** | Grand total including calculated taxes. |

