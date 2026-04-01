// Sales Credit Note — modbm report template
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
#show: doc => conf(title: "CREDIT NOTE", doc)

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
    #if "returnMeta" in data [
      #v(0.1cm)
      #text(10pt, weight: "semibold")[#data.returnMeta.returnNumber]
      #if data.returnMeta.state != "" [
        #h(6pt)
        #text(9pt, fill: luma(100))[(#data.returnMeta.state)]
      ]
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

// ── Table: Order Lines ──────────────────────────────────────────────────────
#table(
  columns: (0.9fr, 2fr, 0.6fr, 0.9fr, 0.6fr, 0.6fr, 1.2fr, 0.8fr, 1.1fr),
  inset: (x: 6pt, y: 10pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: (left, left, center, right, center, center, left, right, right),
  
  // Header Row
  text(8pt, weight: "bold", fill: luma(50))[Code],
  text(8pt, weight: "bold", fill: luma(50))[Description],
  text(8pt, weight: "bold", fill: luma(50))[Qty],
  text(8pt, weight: "bold", fill: luma(50))[Unit Price],
  text(8pt, weight: "bold", fill: luma(50))[Disc %],
  text(8pt, weight: "bold", fill: luma(50))[Tax],
  text(8pt, weight: "bold", fill: luma(50))[Reason],
  text(8pt, weight: "bold", fill: luma(50))[Fee],
  text(8pt, weight: "bold", fill: luma(50))[Amount],

  ..for line in data.lines {
    (
      text(8pt)[#line.productNumber],
      text(8pt)[#if line.description != "" [#line.description] else [—]],
      text(8pt)[#line.quantity],
      text(8pt)[#fmt(line.pricePerUnit)],
      text(8pt)[#line.discountPercentage],
      text(8pt)[#line.gstRate],
      text(8pt)[#if line.reason != "" [#line.reason] else [—]],
      text(8pt)[#fmt(line.fee)],
      text(8pt, weight: "semibold")[#fmt(line.amount)],
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
      
      text(10pt, weight: "bold")[Total Credit:], 
      text(10pt, weight: "bold")[#data.header.currencyCode #fmt(data.summary.totalCredit)],

      ..if float(data.summary.totalFees) > 0 {
          (
            text(10pt, weight: "semibold", fill: rgb("#991b1b"))[Less Fees:],
            text(10pt, weight: "semibold", fill: rgb("#991b1b"))[− #data.header.currencyCode #fmt(data.summary.totalFees)],
          )
      },
      
      grid.cell(colspan: 2)[#v(2pt) #line(length: 100%, stroke: 1.5pt + luma(80)) #v(2pt)],

      text(12pt, weight: "bold")[Net Credit:], 
      text(12pt, weight: "bold", fill: rgb("#1e3a5f"))[#data.header.currencyCode #fmt(data.summary.netCredit)],

    )
  ]
)

#v(2.5cm)

#if "returnMeta" in data and data.returnMeta.notes != "" [
  #text(9pt, weight: "semibold")[Notes:] \
  #text(9pt)[#data.returnMeta.notes]
  #v(1cm)
]

#text(8pt, fill: luma(120), style: "italic")[
  Thank you for your business.
]
