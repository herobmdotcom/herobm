---
id: products
title: "Products & Pricing"
description: "Manage product catalogues, SKUs, barcode tracking, price tiers, kits/bundles, and unit costs."
category: "Inventory"
order: 9
resource: "products"
action: "read"
routes:
  - "/products"
  - "/products/:id"
tags: ["products", "catalogue", "pricing", "kits", "bom", "units-of-measure"]
fields:
  product_number:
    title: "Product Code / SKU"
    summary: "Unique product identifier (e.g. SKU-10492)."
  name:
    title: "Product Name"
    summary: "Item description displayed across orders, invoices, and pick slips."
  product_type:
    title: "Product Type"
    summary: "Stock classification: Stocked Item, Non-Stock Item, Service, or Freight."
  structure_type:
    title: "Structure / Kit"
    summary: "Standard product or Kit/Bundle with component decomposition."
  list_price:
    title: "List Price (Scale 1)"
    summary: "Standard retail price in base currency (EUR)."
  trade_price:
    title: "Trade Price (Scale 2)"
    summary: "Commercial wholesale price for trade customer accounts."
  price_level_3:
    title: "Tier 3 Price"
    summary: "Volume distributor price level."
  price_level_4:
    title: "Tier 4 Price"
    summary: "Special contracted / enterprise price level."
  standard_cost:
    title: "Standard Unit Cost"
    summary: "Current replacement cost used for inventory valuation and margin reporting."
  purchase_tax_category_id:
    title: "Purchase Tax Category"
    summary: "Default GST/VAT tax category assigned to this item for purchasing."
  sales_tax_category_id:
    title: "Sales Tax Category"
    summary: "Default GST/VAT tax category assigned to this item for sales."
related:
  - "inventory"
  - "sales-orders"
  - "purchase-orders"
---

# Products & Pricing

The **Products** module manages master catalog items, barcode tracking, 4-tier price scales, kit bundle definitions, and standard unit costs.

---

## Product Types & Pricing Tiers

### 1. Product Types
- **Stocked Item**: Physical inventory tracked in warehouse bins with on-hand counts.
- **Non-Stock Item**: Purchased on demand or drop-shipped directly without bin tracking.
- **Service**: Non-physical labor or maintenance charges.
- **Freight**: Transport and delivery charges.

### 2. The 4 Price Scales
Every product carries up to four predefined price tiers in the company base currency:
1. **List Price**: Standard retail rate.
2. **Trade Price**: Reseller / commercial rate.
3. **Tier 3 Price**: High-volume wholesale rate.
4. **Tier 4 Price**: Contracted partner rate.

### 3. Kits & Bundles (BOM)
A product can be configured as a **Kit**:
- Sold under a single SKU at a bundle price.
- Contains child component items with specified quantities.
- When sold, component quantities are picked from stock, while the customer invoice shows the clean bundle item.

---

## Step-by-Step Workflows

### 1. Adding a New Product
1. Go to **Inventory** → **Products** (`/products`).
2. Click **+ New Product**.
3. Enter the **Product Code / SKU**, **Name**, and **Product Group**.
4. Select the **Product Type** (e.g. Stocked Item) and **Base Unit of Measure** (e.g. EA, BOX).
5. Enter the **Standard Cost** and the four selling price levels (**List Price**, **Trade Price**, etc.).
6. Select the default **Purchase Tax Category** and **Sales Tax Category**.
7. Click **Save Product**.

### 2. Setting Up a Kit / Bundle
1. Open the product details page.
2. Set **Structure Type** to **Kit**.
3. In the **Bill of Materials / Components** tab, click **+ Add Component**.
4. Search for child products and enter the required quantity per kit.
5. Click **Save Changes**.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Product Code / SKU** | Unique catalog code. |
| **Product Name** | Full commercial description. |
| **Product Type** | `Stocked`, `Non-Stock`, `Service`, or `Freight`. |
| **Standard Cost** | Current unit cost for GL valuation. |
| **Price Scales (1–4)** | 4-tier pricing matrix. |
| **Purchase Tax Category** | Default tax rate classification for purchasing. |
| **Sales Tax Category** | Default tax rate classification for sales. |
| **Base UOM** | Primary stocking unit (e.g. EA, KG, LTR). |
