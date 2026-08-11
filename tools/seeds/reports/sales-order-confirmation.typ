// Sales Order Confirmation — herobm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))
#let fmt(val) = {
  if val == none { return "—" }
  let n = float(val)
  let s = str(calc.round(n, digits: 2))
  let parts = s.split(".")
  if parts.len() == 1 {
    s + ".00"
  } else if parts.at(1).len() == 1 {
    s + "0"
  } else {
    s
  }
}



#import "theme-external.typ": conf
#show: doc => conf(title: "ORDER CONFIRMATION", doc)

#set text(size: 10pt)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold")[#data.header.orderNumber] \
    #if data.header.name != "" [
      #v(-0.1cm)
      #text(9pt, fill: luma(120))[#data.header.name]
    ]
  ],
  align(right)[
    #text(9pt, fill: luma(100))[
      Generated on: #data.generatedAt
    ]
  ]
)

#v(0.8cm)

// ── Customer & Order Info ──────────────────────────────────────────────────
#grid(
  columns: (1.2fr, 0.8fr),
  gutter: 20pt,
  [
    #text(9pt, weight: "bold", fill: luma(80))[CUSTOMER] \
    #v(0.1cm)
    #text(11pt, weight: "semibold")[#data.header.customerName]
  ],
  [
    #grid(
      columns: (auto, 1fr),
      row-gutter: 8pt,
      column-gutter: 12pt,
      text(9pt, weight: "bold", fill: luma(80))[Date:], data.header.orderDate,
      text(9pt, weight: "bold", fill: luma(80))[Customer PO:], if data.header.customerOrderNumber != "" [#data.header.customerOrderNumber] else [—],
      text(9pt, weight: "bold", fill: luma(80))[Currency:], data.header.currencyCode,
    )
  ]
)

#v(1cm)

#if "customPdfText" in data and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(1cm)
]

// ── Table: Order Lines ──────────────────────────────────────────────────────
#table(
  columns: (1fr, 3fr, 0.7fr, 1.2fr, 0.8fr, 0.8fr, 1.4fr),
  inset: (x: 8pt, y: 10pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: (left, left, center, right, center, center, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: luma(50))[Code],
  text(9pt, weight: "bold", fill: luma(50))[Description],
  text(9pt, weight: "bold", fill: luma(50))[Qty],
  text(9pt, weight: "bold", fill: luma(50))[Unit Price],
  text(9pt, weight: "bold", fill: luma(50))[Disc %],
  text(9pt, weight: "bold", fill: luma(50))[Tax],
  text(9pt, weight: "bold", fill: luma(50))[Amount],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    (
      text(9pt)[#line.at("productNumber", default: "")],
      text(9pt)[#if desc != "" [#desc] else [—]],
      text(9pt)[#line.at("quantity", default: 0)],
      text(9pt)[#fmt(line.at("pricePerUnit", default: 0))],
      text(9pt)[#line.at("discountPercentage", default: 0)],
      text(9pt)[#line.at("tax", default: 0)],
      text(9pt, weight: "semibold")[#fmt(line.at("amount", default: 0))],
    )
  }
)

#v(0.6cm)

// ── Summary / Totals ────────────────────────────────────────────────────────
#grid(
  columns: (1fr, 0.4fr),
  [],
  [
    #grid(
      columns: (1fr, auto),
      row-gutter: 10pt,
      column-gutter: 20pt,
      align: (left, right),
      [Subtotal:], [#data.header.currencyCode #fmt(data.summary.subtotal)],
      [Total Tax:], [#data.header.currencyCode #fmt(data.summary.totalTax)],
      
      grid.cell(colspan: 2)[#line(length: 100%, stroke: 1pt + luma(230))],
      
      text(12pt, weight: "bold")[Total:], 
      text(12pt, weight: "bold", fill: rgb("#1e3a5f"))[#data.header.currencyCode #fmt(data.summary.totalAmount)],
    )
  ]
)

#v(2.5cm)

#text(8pt, fill: luma(120), style: "italic")[
  Thank you for your business. Please review the details of your order above and contact us immediately if there are any discrepancies.
]
