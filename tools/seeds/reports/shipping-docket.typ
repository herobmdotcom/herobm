#import "theme-external.typ": conf
#show: doc => conf(title: "SHIPPING DOCKET", doc)

#let data = json(sys.inputs.at("data"))

#set text(size: 10pt)

// ── Header ──────────────────────────────────────────────────────────────────
#align(center)[
  #text(16pt, weight: "bold")[Shipping Docket]
]
#v(0.5cm)

#grid(
  columns: (1fr, 1fr),
  row-gutter: 8pt,
  [*Shipment \#:* #data.header.shipmentNumber],
  [*Order \#:* #data.header.orderNumber],
  [*Customer:* #data.header.customerName],
  [*Date:* #data.header.dispatchDate],
  [*Tracking \#:* #data.header.trackingNumber],
  [*Address:* #data.header.customerAddress],
)

#v(0.8cm)

// ── Table: Shipped Items ────────────────────────────────────────────────────
#text(12pt, weight: "bold")[Shipped Items]
#v(0.3cm)

#if data.lines.len() > 0 {
  table(
    columns: (1.5fr, 3fr, 1fr),
    inset: 8pt,
    stroke: 0.5pt + luma(180),
    fill: (_, row) => if row == 0 { luma(240) },
    align: (left, left, right),
    [*Product Code*], [*Description*], [*Qty Shipped*],
    ..for line in data.lines {
      (
        [#line.at("productCode", default: "—")],
        [#line.at("description", default: "—")],
        [#str(line.at("quantityShipped", default: 0))]
      )
    }
  )
} else {
  emph[No items in this shipment.]
}

#v(1cm)

#if data.header.notes != "" {
  [*Notes:*]
  v(0.1cm)
  data.header.notes
  v(1cm)
}

// ── Signature Line ──────────────────────────────────────────────────────────
#v(2cm)
#grid(
  columns: (1fr, 1fr),
  gutter: 40pt,
  [
    #line(length: 100%, stroke: 0.5pt)
    #text(8pt)[Received By (Name)]
  ],
  [
    #line(length: 100%, stroke: 0.5pt)
    #text(8pt)[Signature & Date]
  ]
)
