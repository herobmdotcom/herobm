// Sales Quote — modbm report template
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

#set text(size: 10pt)

// ── Header ──────────────────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(22pt, weight: "bold", fill: rgb("#1e3a5f"))[SALES QUOTE] \
    #v(0.2cm)
    #text(12pt, weight: "semibold")[#data.header.orderNumber] \
    #if data.header.name != "" [
      #v(-0.1cm)
      #text(9pt, fill: luma(120))[#data.header.name]
    ]
  ],
  align(right)[
    #text(12pt, weight: "bold")[Antigravity ModBM] \
    #text(9pt, fill: luma(100))[
      123 Tech Park, Innovation Way \
      Dublin, Ireland \
      #link("mailto:sales@antigravity.io")[sales\@antigravity.io]
    ]
  ]
)

#v(1.2cm)

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
    (
      text(9pt)[#line.productNumber],
      text(9pt)[#if line.description != "" [#line.description] else [—]],
      text(9pt)[#line.quantity],
      text(9pt)[#line.pricePerUnit],
      text(9pt)[#line.discountPercentage],
      text(9pt)[#line.gstRate],
      text(9pt, weight: "semibold")[#line.amount],
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
      [Subtotal:], [#data.header.currencyCode #data.summary.subtotal],
      [Total Tax:], [#data.header.currencyCode #data.summary.totalTax],
      
      grid.cell(colspan: 2)[#line(length: 100%, stroke: 1pt + luma(230))],
      
      text(12pt, weight: "bold")[Total:], 
      text(12pt, weight: "bold", fill: rgb("#1e3a5f"))[#data.header.currencyCode #data.summary.totalAmount],
    )
  ]
)

#v(2.5cm)

#text(8pt, fill: luma(120), style: "italic")[
  This quote is valid for 30 days. Prices are subject to availability.
]
