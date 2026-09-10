---
id: shipments
title: "Shipments & Delivery"
description: "Manage outbound shipments, packing slips, shipping labels, carrier tracking, and order dispatch."
category: "Sales"
order: 5
resource: "orders"
action: "read"
routes:
  - "/shipments"
  - "/shipments/:id"
tags: ["shipments", "shipping", "delivery", "tracking", "packing", "dispatch", "labels", "email"]
fields:
  shipment_number:
    title: "Shipment Number"
    summary: "Unique shipment identifier (e.g. SHP-2026-00089)."
  sales_order_id:
    title: "Sales Order"
    summary: "Originating sales order for the dispatched items."
  tracking_number:
    title: "Tracking Number"
    summary: "Consignment tracking code provided by the carrier."
  status:
    title: "Shipment Status"
    summary: "Current shipment stage (Draft, Dispatched, Partially Received, Received, Cancelled)."
related:
  - "sales-orders"
  - "inventory-shipping"
  - "sales-invoices"
---

# Shipments & Delivery

The **Shipments** module tracks the physical packaging and dispatch of goods to customers. It links warehouse picking to carrier tracking numbers, generates shipping labels and delivery dockets, supports customer emailing, and automatically updates sales order fulfillment states.

---

## Shipment Lifecycle & Rules

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Shipment
    Draft --> Dispatched : Hand Over to Carrier / Dispatch
    Dispatched --> PartiallyReceived : Partial Inbound Delivery
    Dispatched --> Received : Final Receipt Confirmed
    PartiallyReceived --> Received : Complete Delivery
    Draft --> Cancelled : Cancel
    Dispatched --> Cancelled : Void / Return to Depot
    PartiallyReceived --> Cancelled : Void
```

### Key Rules
1. **Partial Shipments Supported**: Multiple shipments can be created against a single sales order when fulfilling in batches.
2. **Auto-Transition to Shipped**: When all line items on a sales order have been 100% dispatched across shipments, the sales order automatically updates from `picking` to `shipped`.
3. **Fast-Track Barcode Dispatch**: For high-volume warehouse fulfillment, operators can bypass manual shipment entry by using the [Scan-to-Dispatch](./shipping.md) station (`/inventory/shipping/scan-to-dispatch`) to automatically create and dispatch shipments upon scanning.
4. **Reverting Shipments**: If a shipment is cancelled before delivery receipt, the committed quantities are released back to the warehouse, and if the order is no longer 100% shipped, its status reverts to `picking`.

---

## Document Generation & Customer Emailing

- **Print Shipping Label**: Generates a standardized Typst carrier dispatch label formatted with customer address, barcode, package counts, and carrier routing info.
- **Print Shipping Docket**: Generates a packing docket itemizing dispatched SKUs, quantities, and serials for inclusion inside the parcel.
- **Email Shipping Docket**: Opens the document email dialog to send the dispatch notification and PDF docket directly to the customer's delivery contact.

---

## Step-by-Step Workflows

### 1. Creating and Dispatching a Shipment (Manual Workbench)
1. Go to **Sales** → **Shipments** (`/shipments`).
2. Click **New Shipment** and select the **Sales Order**.
3. Verify the delivery address and packed line quantities.
4. Select the **Carrier** and enter the **Tracking Number**.
5. Click **Print Shipping Label** to affix to cartons.
6. Click **Print Shipping Docket** or **Email Docket** to send confirmation to the client.
7. Click **Mark as Dispatched**.

### 2. Fast-Track Barcode Dispatch
- Use the **Scan-to-Dispatch** terminal (`/inventory/shipping/scan-to-dispatch`) to scan Zebra pick labels directly, create shipments automatically, and mark them `Dispatched` in real time.

---

## Field Reference

| Field | Description |
| :--- | :--- |
| **Shipment Number** | Unique shipment tracking identifier (`SHP-...`). |
| **Sales Order** | The parent sales order being fulfilled (`ORD-...`). |
| **Tracking Number** | Waybill / carrier consignment code for parcel tracking. |
| **Shipment Notes** | Internal memo for this specific shipment dispatch. |
| **Status** | Stage in dispatch workflow (`Draft`, `Dispatched`, `Partially Received`, `Received`, `Cancelled`). |
| **Delivery Address** | Destination physical address for delivery. |
| **Delivery Instructions** | Special carrier instructions from the order. |

---

## Notes & Tracking Reference Guide

The system clearly distinguishes between **internal** notes (private operational memos) and **external** instructions (printed on customer or carrier documents):

| Field Name | Origin / Scope | Classification | Target Audience | Where to Enter / Edit | Printed on Documents / PDFs |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Delivery Instructions** (`shippingNotes`) | Sales Order / Transfer Order | **External** | Carrier drivers, dispatchers | Sales Order &rarr; **Delivery** card; Shipping workbench | **Printed on Shipping Labels** (`DELIVERY INSTRUCTIONS:` box). Included in Shipping Docket data payload. |
| **Shipment Notes** (`notes`) | Outbound Shipment | **Internal** | Warehouse team, logistics history | **Create Shipment** dialog, **Pick & Ship** panel, Shipment details | Kept off customer documents; saved in shipment audit record and inventory dispatch memo (`DSP-DIR-...`). |
| **Order Notes** (`notes`) | Sales Order | **Internal** | Sales team, customer service, operations | Sales Order &rarr; **Notes** card; Counter Sales checkout | **Not printed** on any customer PDFs (Quotes, Confirmations, Invoices, Dockets) to prevent private sales remarks leaking. |
| **Tracking Number** (`trackingNumber`) | Outbound Shipment | **External** | Customer, carrier, warehouse | **Create Shipment** dialog, **Pick & Ship** panel, Shipping Workbench | **Printed on Shipping Dockets** and encoded as barcode/QR code on **Shipping Labels**. |
| **Line Item Comments** (`productDescription`) | Order Line (`lineType = 'Comment'`) | **External** | Customer, pickers, receiving dock | Sales Order lines table | **Printed directly in line item tables** on Quotes, Confirmations, Invoices, and Shipping Dockets. |
| **Document Cover / Intro Text** (`customPdfText` / `quoteIntroText`) | Dynamic PDF generation | **External** | Customer | Email / Print document modal dialog | **Printed in header banner** on Quotes, Order Confirmations, Invoices, and Shipping Dockets. |

