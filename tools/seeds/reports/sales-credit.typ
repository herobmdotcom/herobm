// Sales Credit Note — herobm report template
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
#show: doc => conf(title: "CREDIT NOTE", doc)

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
    #if "returnMeta" in data and data.returnMeta != none and "returnNumber" in data.returnMeta [
      #v(0.1cm)
      #text(10pt, weight: "semibold")[#data.returnMeta.returnNumber]
      #if "state" in data.returnMeta and data.returnMeta.state != none and data.returnMeta.state != "" [
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
      text(9pt, weight: "bold", fill: luma(80))[Customer PO:], if "customerOrderNumber" in data.header and data.header.customerOrderNumber != "" and data.header.customerOrderNumber != none [#data.header.customerOrderNumber] else [—],
      text(9pt, weight: "bold", fill: luma(80))[Currency:], data.header.currencyCode,
    )
  ]
)

#v(1cm)

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
  (1.6fr, 2.6fr, 0.6fr, 0.9fr, 0.6fr, 0.6fr, 1.2fr, 0.7fr, 1.0fr)
} else {
  (1.8fr, 3.0fr, 0.6fr, 0.9fr, 0.6fr, 1.2fr, 0.7fr, 1.0fr)
}

#let tableAlign = if hasDiscount {
  (left, left, center, right, right, right, left, right, right)
} else {
  (left, left, center, right, right, left, right, right)
}

// ── Table: Order Lines ──────────────────────────────────────────────────────
#table(
  columns: tableColumns,
  inset: (x: 5pt, y: 8pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: tableAlign,
  
  // Header Row
  text(8pt, weight: "bold", fill: luma(50))[Code],
  text(8pt, weight: "bold", fill: luma(50))[Description],
  text(8pt, weight: "bold", fill: luma(50))[Qty],
  text(8pt, weight: "bold", fill: luma(50))[Unit Price],
  ..(if hasDiscount { (text(8pt, weight: "bold", fill: luma(50))[Disc %],) } else { () }),
  text(8pt, weight: "bold", fill: luma(50))[Tax],
  text(8pt, weight: "bold", fill: luma(50))[Reason],
  text(8pt, weight: "bold", fill: luma(50))[Fee],
  text(8pt, weight: "bold", fill: luma(50))[Amount],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    let rsn = line.at("reason", default: "")
    (
      text(8pt)[#line.at("productNumber", default: "")],
      text(8pt)[#if desc != "" [#desc] else [—]],
      text(8pt)[#fmtQty(line.at("quantity", default: 0))],
      text(8pt)[#fmt(line.at("pricePerUnit", default: 0))],
      ..(if hasDiscount { (text(8pt)[#line.at("discountPercentage", default: 0)],) } else { () }),
      text(8pt)[#line.at("tax", default: 0)],
      text(8pt)[#if rsn != "" [#rsn] else [—]],
      text(8pt)[#fmt(line.at("fee", default: 0))],
      text(8pt, weight: "semibold")[#fmt(line.at("amount", default: 0))],
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

      ..if "totalFees" in data.summary and data.summary.totalFees != none and data.summary.totalFees != "" and float(data.summary.totalFees) > 0 {
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



#text(8pt, fill: luma(120), style: "italic")[
  Thank you for your business.
]
