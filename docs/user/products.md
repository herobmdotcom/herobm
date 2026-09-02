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
    summary: "Stock classification: Inventory (Tracked) (`inventory`), Non-Stock (`non-stock`), Service (`service`), or Freight (`freight`)."
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
  weighted_average_cost:
    title: "Weighted Average Cost (WAC)"
    summary: "Dynamically calculated rolling unit cost based on receipt transaction history. Used for inventory valuation and COGS."
  preferred_supplier_cost:
    title: "Preferred Supplier Cost"
    summary: "Negotiated unit price from the primary preferred vendor, factoring in contracted discount percentages."
  last_purchase_price:
    title: "Last PO Price"
    summary: "Unit price paid on the most recent purchase order line item."
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
- **Inventory (Tracked)** (`inventory`): Physical stock tracked in warehouse bins with on-hand counts and perpetual ledger valuation.
- **Non-Stock** (`non-stock`): Purchased on demand or drop-shipped directly without bin tracking.
- **Service** (`service`): Non-physical labor or maintenance charges.
- **Freight** (`freight`): Transport and delivery charges.

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

## Cost Metrics & Valuation Calculations

HeroBM tracks four complementary cost metrics to provide complete visibility into purchasing history, replacement benchmarks, and real-time inventory valuation:

### 1. Standard Cost (Target / Benchmark)
- **Definition**: A fixed, manually configured unit cost set by management.
- **Usage**: Serves as a standard budgeting baseline, target gross margin benchmark, and baseline replacement cost when historical purchasing data is not yet available.
- **Editing**: Editable directly in the **Costs** section of the Product Details page.

### 2. Weighted Average Cost (WAC — Inventory Valuation Basis)
- **Definition**: The rolling weighted average purchase price of current on-hand stock.
- **Calculation**: Automatically recalculated upon every stock receipt in the inventory ledger:
  `New WAC = ((Current QOH * Current WAC) + (Received Qty * Received Unit Cost)) / (Current QOH + Received Qty)`
- **Usage**: Powers accurate balance sheet asset valuation (`Total Value = QOH * WAC`) and Cost of Goods Sold (COGS) accounting upon sales fulfillment.

### 3. Preferred Supplier Cost
- **Definition**: The contracted cost price configured for the product's primary/preferred vendor in the **Suppliers** tab.
- **Discount Calculation**: Reflects the net cost after applying supplier contract discounts:
  `Net Supplier Cost = Cost Price * (1 - (Discount % / 100))`
- **Usage**: Defaults automatically onto new Purchase Orders generated for this supplier.

### 4. Last Purchase Order Price
- **Definition**: The actual unit price recorded on the most recent approved purchase order line.
- **Usage**: Provides instant operational visibility into recent market price trends and supplier billing fluctuations.

---

## Step-by-Step Workflows

### 1. Adding a New Product
1. Go to **Inventory** → **Products** (`/products`).
2. Click **New Product**.
3. Enter the **Product Code / SKU**, **Name**, and **Product Group**.
4. Select the **Product Type** (e.g. Inventory (Tracked)) and **Base Unit of Measure** (e.g. EA, BOX).
5. Enter the **Standard Cost** and the four selling price levels (**List Price**, **Trade Price**, etc.).
6. Select the default **Purchase Tax Category** and **Sales Tax Category**.
7. Click **Save Product**.

### 2. Setting Up a Kit / Bundle
1. Open the product details page.
2. Set **Structure Type** to **Kit**.
3. In the **Bill of Materials / Components** tab, click **Add Component**.
4. Search for child products and enter the required quantity per kit.
5. Click **Save Changes**.

## Product Image Storage

HeroBM supports uploading primary images for products, which are displayed on the Ops Portal and synced with integrations.

**Where images are stored:**
- Product images are saved securely on the host server filesystem rather than inside the database itself.
- By default, the API container mounts the `./data/storage` directory from your HeroBM installation folder.
- Manual uploads via the UI are physically stored under `<herobm-root>/data/storage/products/uploads/<product-id>/`.
- For legacy database imports (such as ABM, Odoo, etc.), image paths are mapped directly to the `products/` folder. You should copy the contents of your legacy images folder directly into `<herobm-root>/data/storage/products/`.
- If you are running a custom deployment, the root storage path can be overridden by setting the `STORAGE_PATH` environment variable in your `.env` file.

**Uploading Images:**
Images should be uploaded via the Ops Portal UI on the Product detail page, or via the `POST /products/images/{id}` API endpoint. The system automatically handles resizing, safe file naming, and database path linkage.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Product Code / SKU** | Unique catalog code. |
| **Product Name** | Full commercial description. |
| **Product Type** | `Stocked`, `Non-Stock`, `Service`, or `Freight`. |
| **Standard Cost** | Current unit cost benchmark for GL valuation and budgeting. |
| **Weighted Average Cost (WAC)** | Rolling inventory valuation unit cost basis calculated from stock receipts. |
| **Preferred Supplier Cost** | Contracted purchase price from the primary vendor, including discount. |
| **Last PO Price** | Most recent historical purchase order unit cost. |
| **Price Scales (1–4)** | 4-tier pricing matrix. |
| **Purchase Tax Category** | Default tax rate classification for purchasing. |
| **Sales Tax Category** | Default tax rate classification for sales. |
| **Base UOM** | Primary stocking unit (e.g. EA, KG, LTR). |
