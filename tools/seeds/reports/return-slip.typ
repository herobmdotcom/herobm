// Return Slip — herobm report template
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
#show: doc => conf(title: "RETURN SLIP", doc)

#set text(size: 10pt)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(9pt, weight: "bold", fill: luma(80))[ORDER] \
    #text(12pt, weight: "semibold")[#data.header.orderNumber] \
    #if "returnMeta" in data and data.returnMeta != none and "returnNumber" in data.returnMeta [
      #v(0.1cm)
      #text(9pt, weight: "bold", fill: luma(80))[RETURN] \
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
      text(9pt, weight: "bold", fill: luma(80))[Customer PO:], if "customerOrderNumber" in data.header and data.header.customerOrderNumber != "" and data.header.customerOrderNumber != none [#data.header.customerOrderNumber] else [—]
    )
  ]
)

#v(0.6cm)

// ── Return To Info ─────────────────────────────────────────────────────────
#if "returnToAddress" in data and data.returnToAddress != none [
  #let addr = data.returnToAddress
  #grid(
    columns: (1fr),
    gutter: 5pt,
    [
      #text(9pt, weight: "bold", fill: luma(80))[SHIP TO] \
      #v(0.1cm)
      #text(11pt, weight: "semibold")[#addr.at("name", default: "")] \
      #if addr.at("addressLine1", default: "") != "" and addr.at("addressLine1", default: "") != none [#text(10pt)[#addr.addressLine1] \ ]
      #if addr.at("addressLine2", default: "") != "" and addr.at("addressLine2", default: "") != none [#text(10pt)[#addr.addressLine2] \ ]
      #let cityState = (addr.at("city", default: ""), addr.at("stateOrProvince", default: ""), addr.at("postalCode", default: "")).filter(x => x != "" and x != none).join(" ")
      #if cityState != "" [#text(10pt)[#cityState] \ ]
      #if addr.at("country", default: "") != "" and addr.at("country", default: "") != none [#text(10pt)[#addr.country] \ ]
    ]
  )
  #v(0.6cm)
] else [
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

// ── Table: Order Lines ──────────────────────────────────────────────────────
#table(
  columns: (2.2fr, 4fr, 1fr, 2.2fr),
  inset: (x: 6pt, y: 8pt),
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
      text(8pt, weight: "bold")[#fmtQty(line.at("quantity", default: 0))],
      text(8pt)[#if rsn != "" [#rsn] else [—]],
    )
  }
)

#v(0.6cm)



#text(8pt, fill: luma(120), style: "italic")[
  Please include this slip with your returned goods.
]
