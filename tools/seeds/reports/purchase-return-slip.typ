// Purchase Return Slip — herobm report template
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

#import "theme-supplier.typ": conf, getTheme
#show: doc => conf(title: "PURCHASE RETURN SLIP", doc)

#let theme = getTheme(data)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold", fill: theme.primaryColor)[#data.header.returnNumber] \
    #if "state" in data.header and data.header.state != none and data.header.state != "" [
      #v(-0.1cm)
      #text(9pt, fill: theme.mutedColor)[Status: #data.header.state]
    ]
  ],
  align(right)[
    #text(9pt, fill: theme.mutedColor)[
      Generated on: #data.generatedAt
    ]
  ]
)

#v(0.8cm)

// ── Supplier & Return Info ─────────────────────────────────────────────────
#grid(
  columns: (1.2fr, 0.8fr),
  gutter: 20pt,
  [
    #text(9pt, weight: "bold", fill: theme.accentColor)[SUPPLIER] \
    #v(0.1cm)
    #text(11pt, weight: "semibold")[#data.header.supplierName] \
    #if "supplierAddress" in data.header and data.header.supplierAddress != none and data.header.supplierAddress != "" [
      #text(9pt, fill: theme.mutedColor)[#data.header.supplierAddress] \
    ]
    #if "supplierContact" in data.header and data.header.supplierContact != none and data.header.supplierContact != "" [
      #text(9pt, fill: theme.mutedColor)[Attn: #data.header.supplierContact]
    ]
  ],
  [
    #grid(
      columns: (auto, 1fr),
      row-gutter: 8pt,
      column-gutter: 12pt,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Date:], data.header.returnDate,
      text(9pt, weight: "bold", fill: theme.mutedColor)[PO Number:], data.header.orderNumber,
      text(9pt, weight: "bold", fill: theme.mutedColor)[RMA / Ref:], if "packingSlipNumber" in data.header and data.header.packingSlipNumber != none and data.header.packingSlipNumber != "" [#data.header.packingSlipNumber] else [—],
      text(9pt, weight: "bold", fill: theme.mutedColor)[Tracking No.:], if "trackingNumber" in data.header and data.header.trackingNumber != none and data.header.trackingNumber != "" [#data.header.trackingNumber] else [—],
      text(9pt, weight: "bold", fill: theme.mutedColor)[Currency:], data.header.currencyCode,
    )
  ]
)

#v(1cm)

#if "customPdfText" in data and data.customPdfText != none and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(1cm)
] else if "quoteIntroText" in data and data.quoteIntroText != none and data.quoteIntroText != "" [
  #text(9pt)[#data.quoteIntroText]
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

// ── Table: Return Lines ────────────────────────────────────────────────────
#table(
  columns: (2fr, 3.2fr, 0.9fr, 0.6fr, 1.6fr, 1fr, 1.1fr),
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, left, center, center, left, right, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: theme.primaryColor)[Code],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Description],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Return Qty],
  text(9pt, weight: "bold", fill: theme.primaryColor)[UoM],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Reason],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Unit Cost],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Amount],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    let reason = line.at("reason", default: "")
    (
      text(9pt)[#line.at("productNumber", default: "")],
      text(9pt)[#if desc != "" [#desc] else [—]],
      text(9pt, weight: "semibold", fill: theme.primaryColor)[#fmtQty(line.at("quantity", default: 0))],
      text(9pt)[#line.at("uom", default: "EA")],
      text(9pt)[#if reason != "" [#reason] else [—]],
      text(9pt)[#fmt(line.at("pricePerUnit", default: 0))],
      text(9pt, weight: "semibold")[#fmt(line.at("amount", default: 0))],
    )
  }
)

#v(0.6cm)

// ── Summary / Totals ────────────────────────────────────────────────────────
#grid(
  columns: (1fr, 0.45fr),
  [],
  [
    #grid(
      columns: (1fr, auto),
      row-gutter: 10pt,
      column-gutter: 20pt,
      align: (left, right),
      [Total Return Value:], [#data.header.currencyCode #fmt(data.summary.subtotal)],
      
      grid.cell(colspan: 2)[#line(length: 100%, stroke: 0.5pt + theme.borderColor)],
      
      text(11pt, weight: "bold")[Total Debit Value:], 
      text(11pt, weight: "bold", fill: theme.accentColor)[#data.header.currencyCode #fmt(data.summary.totalAmount)],
    )
  ]
)

#v(2cm)

#grid(
  columns: (1fr, 1fr),
  gutter: 40pt,
  [
    #text(8pt, fill: theme.mutedColor)[Dispatched By / Signature:] \
    #v(1.2cm)
    #line(length: 100%, stroke: 0.5pt + theme.borderColor)
  ],
  [
    #text(8pt, fill: theme.mutedColor)[Carrier / Tracking Received:] \
    #v(1.2cm)
    #line(length: 100%, stroke: 0.5pt + theme.borderColor)
  ]
)
