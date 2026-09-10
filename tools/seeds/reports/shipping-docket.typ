#import "theme-customer.typ": conf, getTheme
#show: doc => conf(title: "SHIPPING DOCKET", doc)

#let data = json(sys.inputs.at("data"))
#let theme = getTheme(data)

// ── Header ──────────────────────────────────────────────────────────────────
#align(center)[
  #text(16pt, weight: "bold", fill: theme.primaryColor)[Shipping Docket]
]
#v(0.5cm)

#grid(
  columns: (1fr, 1fr),
  row-gutter: 8pt,
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Shipment \#:] #text(10pt, weight: "semibold", fill: theme.primaryColor)[#data.header.shipmentNumber]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Order \#:] #text(10pt, weight: "semibold", fill: theme.primaryColor)[#data.header.orderNumber]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Customer:] #text(10pt, weight: "semibold")[#data.header.customerName]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Date:] #data.header.dispatchDate],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Tracking \#:] #if "trackingNumber" in data.header and data.header.trackingNumber != "" and data.header.trackingNumber != none [#data.header.trackingNumber] else [—]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Address:] #if "customerAddress" in data.header and data.header.customerAddress != "" and data.header.customerAddress != none [#data.header.customerAddress] else [—]],
)

#if "shippingNotes" in data.header and data.header.shippingNotes != "" and data.header.shippingNotes != none [
  #v(0.3cm)
  #rect(
    width: 100%,
    stroke: 0.5pt + theme.borderColor,
    fill: theme.tableHeaderFill,
    inset: (x: 8pt, y: 6pt),
    radius: 3pt,
  )[
    #text(8pt, weight: "bold", fill: theme.mutedColor)[Delivery Instructions:] \
    #v(2pt)
    #text(9pt)[#data.header.shippingNotes]
  ]
]

#v(0.5cm)

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
#text(12pt, weight: "bold", fill: theme.primaryColor)[Shipped Items]
#v(0.3cm)

#let lines = if "lines" in data and data.lines != none { data.lines } else { () }
#if lines.len() > 0 {
  table(
    columns: (2.2fr, 4.8fr, 1fr),
    inset: (x: 8pt, y: 8pt),
    stroke: 0.5pt + theme.borderColor,
    fill: (_, row) => if row == 0 { theme.tableHeaderFill },
    align: (left, left, right),
    text(9pt, weight: "bold", fill: theme.primaryColor)[Product Code],
    text(9pt, weight: "bold", fill: theme.primaryColor)[Description],
    text(9pt, weight: "bold", fill: theme.primaryColor)[Qty Shipped],
    ..for line in lines {
      (
        text(9pt, weight: "semibold")[#line.at("productCode", default: "—")],
        text(9pt)[#line.at("description", default: "—")],
        text(9pt, weight: "bold", fill: theme.primaryColor)[#fmtQty(line.at("quantityShipped", default: 0))]
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
    #line(length: 100%, stroke: 0.5pt + theme.borderColor)
    #text(8pt, fill: theme.mutedColor)[Received By (Name)]
  ],
  [
    #line(length: 100%, stroke: 0.5pt + theme.borderColor)
    #text(8pt, fill: theme.mutedColor)[Signature & Date]
  ]
)
