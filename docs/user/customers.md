---
id: customers
title: "Customer Accounts"
description: "Manage customer profiles, credit limits, price scales, delivery addresses, and trading terms."
category: "Sales"
order: 2
resource: "customers"
action: "read"
routes:
  - "/customers"
  - "/customers/:id"
tags: ["customers", "accounts", "credit", "terms", "contacts", "addresses"]
fields:
  name:
    title: "Customer Name"
    summary: "Legal trade name of the customer company or individual."
  customer_group_id:
    title: "Customer Group"
    summary: "Assigns group defaults for Price Scale (1–4), default payment terms, and group discounts."
  currency_code:
    title: "Operating Currency"
    summary: "Transaction currency for sales orders and invoices (e.g. EUR, SGD, USD)."
  credit_limit:
    title: "Credit Limit"
    summary: "Maximum allowable unpaid balance (outstanding invoices + un-invoiced orders)."
  is_on_credit_hold:
    title: "Credit Hold"
    summary: "When enabled, prevents creating or confirming new sales orders without a manager override."
  trading_terms_id:
    title: "Payment Terms"
    summary: "Standard payment window (e.g. Net 30, COD, Prepayment)."
  tax_position_id:
    title: "Tax Position"
    summary: "Tax exemption and specialized rules are handled relationally via Tax Positions."
  delivery_addresses:
    title: "Delivery Addresses"
    summary: "Multiple destination addresses selectable during sales order creation."
related:
  - "sales-quotes"
  - "sales-orders"
  - "sales-invoices"
  - "balances"
---

# Customer Accounts

The **Customers** module manages commercial accounts, credit controls, pricing scales, payment terms, and delivery addresses.

---

## Business Rules & Settings

### 1. Customer Groups & Price Scales
Every customer belongs to a **Customer Group**. The group determines:
- **Price Scale (1 to 4)**: Starting unit price level used on sales orders.
- **Group Discount %**: Default percentage discount applied to all order lines.
- **Default Payment Terms**: Standard trading terms inherited by new customer records.

### 2. Credit Limits & Credit Holds
- **Credit Limit**: The maximum allowable financial exposure for the account (`Unpaid Invoices + Open Sales Orders`).
- **Credit Hold**: If an account breaches its limit, has overdue invoices, or is manually placed on credit hold, order progression is blocked unless a manager applies a **Credit Hold Override**.

### 3. Multi-Currency & Tax Position
- Each customer is assigned an operating currency (e.g. `EUR`, `SGD`, `USD`). All orders for this customer default to this currency.
- Tax exemption and specialized tax rules are handled relationally via **Tax Positions**, which define the applicable tax rates for this customer.

---

## Step-by-Step Workflows

### 1. Creating a New Customer
1. Go to **Sales** → **Customers** (`/customers`).
2. Click **+ New Customer**.
3. Enter the **Company Name**, **Customer Group**, and **Currency**.
4. Select the **Trading / Payment Terms** and set the **Credit Limit**.
5. Add the primary **Billing Address** and at least one **Delivery Address**.
6. (Optional) Add primary and billing **Contact Persons** with email and phone details.
7. Click **Save Customer**.

### 2. Managing Credit Holds
1. Open the customer details page.
2. In the **Financial Standing** section, view total outstanding receivables and credit headroom.
3. To temporarily suspend ordering, toggle **Credit Hold: ON**.
4. To release a hold, toggle **Credit Hold: OFF** (requires permission).

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Customer Name** | Trading business name. |
| **Customer Group** | Classification tier setting default price scale (1–4) and terms. |
| **Currency** | Transaction currency for all sales orders and invoices. |
| **Credit Limit** | Approved credit limit in customer currency. |
| **Credit Hold** | Status flag blocking new sales order confirmations. |
| **Payment Terms** | Standard settlement timeline (e.g. Net 30, COD). |
| **Tax Position** | Relational link defining tax rules and exemptions. |
| **Delivery Addresses** | Destination addresses for physical shipments. |
