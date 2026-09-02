// Sales Order Confirmation — herobm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))
#let fmt(val) = {
  if val == none or val == "" or val == "—" or str(val).trim() == "" { return "—" }
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
    #if "name" in data.header and data.header.name != none and data.header.name != "" [
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
      text(9pt, weight: "bold", fill: luma(80))[Customer PO:], if "customerOrderNumber" in data.header and data.header.customerOrderNumber != "" and data.header.customerOrderNumber != none [#data.header.customerOrderNumber] else [—],
      text(9pt, weight: "bold", fill: luma(80))[Currency:], data.header.currencyCode,
    )
  ]
)

#v(1cm)

#if "customPdfText" in data and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(1cm)
]

#let fmtQty(val) = {
  if val == none or val == "" or val == "—" or str(val).trim() == "" { return "0" }
  let n = float(val)
  if calc.round(n) == n {
    str(int(n))
  } else {
    str(calc.round(n, digits: 4))
  }
}

#let hasDiscount = data.lines.any(l => {
  let d = l.at("discountPercentage", default: 0)
  if d == none or d == "" or d == "—" { false } else { float(d) > 0.0 }
})

#let tableColumns = if hasDiscount {
  (2.2fr, 4fr, 0.7fr, 1.1fr, 0.8fr, 0.8fr, 1.1fr)
} else {
  (2.5fr, 4.8fr, 0.7fr, 1.1fr, 0.8fr, 1.1fr)
}

#let tableAlign = if hasDiscount {
  (left, left, center, right, right, right, right)
} else {
  (left, left, center, right, right, right)
}

// ── Table: Order Lines ──────────────────────────────────────────────────────
#table(
  columns: tableColumns,
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: tableAlign,
  
  // Header Row
  text(9pt, weight: "bold", fill: luma(50))[Code],
  text(9pt, weight: "bold", fill: luma(50))[Description],
  text(9pt, weight: "bold", fill: luma(50))[Qty],
  text(9pt, weight: "bold", fill: luma(50))[Unit Price],
  ..(if hasDiscount { (text(9pt, weight: "bold", fill: luma(50))[Disc %],) } else { () }),
  text(9pt, weight: "bold", fill: luma(50))[Tax],
  text(9pt, weight: "bold", fill: luma(50))[Amount],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    (
      text(9pt)[#line.at("productNumber", default: "")],
      text(9pt)[#if desc != "" [#desc] else [—]],
      text(9pt)[#fmtQty(line.at("quantity", default: 0))],
      text(9pt)[#fmt(line.at("pricePerUnit", default: 0))],
      ..(if hasDiscount { (text(9pt)[#line.at("discountPercentage", default: 0)],) } else { () }),
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
