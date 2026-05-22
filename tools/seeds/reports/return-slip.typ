// Return Slip — modbm report template
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
#show: doc => conf(title: "RETURN SLIP", doc)

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
  columns: (1.2fr, 2.5fr, 1fr, 2fr),
  inset: (x: 6pt, y: 10pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: (left, left, center, left),
  
  // Header Row
  text(8pt, weight: "bold", fill: luma(50))[Code],
  text(8pt, weight: "bold", fill: luma(50))[Description],
  text(8pt, weight: "bold", fill: luma(50))[Return Qty],
  text(8pt, weight: "bold", fill: luma(50))[Reason],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    let rsn = line.at("reason", default: "")
    (
      text(8pt)[#line.at("productNumber", default: "")],
      text(8pt)[#if desc != "" [#desc] else [—]],
      text(8pt, weight: "bold")[#line.at("quantity", default: 0)],
      text(8pt)[#if rsn != "" [#rsn] else [—]],
    )
  }
)

#v(0.6cm)

#if "returnMeta" in data and data.returnMeta.notes != "" [
  #text(9pt, weight: "semibold")[Notes:] \
  #text(9pt)[#data.returnMeta.notes]
  #v(1cm)
]

#text(8pt, fill: luma(120), style: "italic")[
  Please include this slip with your returned goods.
]
