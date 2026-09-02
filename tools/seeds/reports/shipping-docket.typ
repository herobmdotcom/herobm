#import "theme-external.typ": conf
#show: doc => conf(title: "SHIPPING DOCKET", doc)

#let data = json(sys.inputs.at("data"))

#set text(font: ("DejaVu Sans", "Liberation Sans", "Helvetica", "Arial"), size: 10pt)

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
  [*Tracking \#:* #if "trackingNumber" in data.header and data.header.trackingNumber != "" and data.header.trackingNumber != none [#data.header.trackingNumber] else [—]],
  [*Address:* #if "customerAddress" in data.header and data.header.customerAddress != "" and data.header.customerAddress != none [#data.header.customerAddress] else [—]],
)

#v(0.8cm)

#if "customPdfText" in data and data.customPdfText != none and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(0.8cm)
] else if "quoteIntroText" in data and data.quoteIntroText != none and data.quoteIntroText != "" [
  #text(9pt)[#data.quoteIntroText]
  #v(0.8cm)
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

// ── Table: Shipped Items ────────────────────────────────────────────────────
#text(12pt, weight: "bold")[Shipped Items]
#v(0.3cm)

#let lines = if "lines" in data and data.lines != none { data.lines } else { () }
#if lines.len() > 0 {
  table(
    columns: (2.2fr, 4.8fr, 1fr),
    inset: (x: 8pt, y: 8pt),
    stroke: 0.5pt + luma(210),
    fill: (_, row) => if row == 0 { rgb("#f8fafc") },
    align: (left, left, right),
    text(9pt, weight: "bold", fill: luma(50))[Product Code],
    text(9pt, weight: "bold", fill: luma(50))[Description],
    text(9pt, weight: "bold", fill: luma(50))[Qty Shipped],
    ..for line in lines {
      (
        text(9pt, weight: "semibold")[#line.at("productCode", default: "—")],
        text(9pt)[#line.at("description", default: "—")],
        text(9pt, weight: "bold")[#fmtQty(line.at("quantityShipped", default: 0))]
      )
    }
  )
} else {
  emph[No items in this shipment.]
}

#v(1cm)



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
