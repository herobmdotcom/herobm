// Picking Slip — modbm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))

#set page(
  paper: "a4",
  margin: (top: 2cm, bottom: 2.5cm, left: 2cm, right: 2cm),
  footer: context [
    #set text(8pt, fill: luma(120))
    #data.generatedAt
    #h(1fr)
    Page #counter(page).display("1 of 1", both: true)
  ],
)

#set text(font: "DejaVu Sans", size: 10pt)

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
#text(12pt, weight: "bold")[Items to Pick]
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
      ([#line.productCode], [#line.description], [#line.binNumber], [#str(line.qtyToPick)])
    }
  )
} else {
  emph[No items to pick — all lines are already picked.]
}

#v(0.8cm)

// ── Table 2: Items to Back-Order ────────────────────────────────────────────
#text(12pt, weight: "bold")[Items to Back-Order]
#v(0.3cm)

#if data.backOrderLines.len() > 0 {
  table(
    columns: (1.5fr, 3fr, 2fr, 1fr),
    inset: 6pt,
    stroke: 0.5pt + luma(180),
    fill: (_, row) => if row == 0 { luma(230) },
    align: (left, left, left, right),
    [*Product Code*], [*Description*], [*Supplier*], [*Qty to Order*],
    ..for line in data.backOrderLines {
      ([#line.productCode], [#line.description], [#line.supplierName], [#str(line.qtyToOrder)])
    }
  )
} else {
  emph[No items require back-ordering.]
}
