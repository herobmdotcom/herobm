#import "theme-internal.typ": conf
#show: doc => conf(title: "Picking Slip", doc)

#let data = json(sys.inputs.at("data"))


#set text(size: 10pt)

// ── Header ──────────────────────────────────────────────────────────────────
#align(center)[
  #text(16pt, weight: "bold")[Picking Slip]
]
#v(0.5cm)

#grid(
  columns: (1fr, 1fr),
  row-gutter: 6pt,
  [*Order:* #data.header.orderNumber],
  [*Customer:* #data.header.customerName],
  [*Customer PO:* #data.header.customerOrderNumber],
  [*Date:* #data.header.orderDate],
)

#v(0.8cm)

// ── Table 1: Items to Pick ──────────────────────────────────────────────────
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [#text(12pt, weight: "bold")[Items to Pick]],
  [#text(10pt, style: "italic")[Location: #data.header.locationName]]
)
#v(0.3cm)

#if data.pickingLines.len() > 0 {
  table(
    columns: (1.5fr, 3fr, 1.5fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt + luma(180),
    fill: (_, row) => if row == 0 { luma(230) },
    align: (left, left, left, right),
    [*Product Code*], [*Description*], [*Bin*], [*Qty to Pick*],
    ..for line in data.pickingLines {
      ([#line.at("productCode", default: "")], [#line.at("description", default: "")], [#line.at("binNumber", default: "")], [#str(line.at("qtyToPick", default: 0))])
    }
  )
} else {
  emph[No items to pick — all lines are already picked.]
}

