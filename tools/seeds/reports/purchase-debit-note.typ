// Purchase Debit Note — herobm report template
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
#show: doc => conf(title: "PURCHASE DEBIT NOTE", doc)

#let theme = getTheme(data)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold", fill: theme.primaryColor)[#data.header.debitNoteNumber] \
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

// ── Supplier & Debit Note Info ─────────────────────────────────────────────
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
      text(9pt, weight: "bold", fill: theme.mutedColor)[Date:], data.header.debitNoteDate,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Supplier Ref:], if "supplierReference" in data.header and data.header.supplierReference != none and data.header.supplierReference != "" [#data.header.supplierReference] else [—],
      text(9pt, weight: "bold", fill: theme.mutedColor)[PO Number:], if "orderNumber" in data.header and data.header.orderNumber != none and data.header.orderNumber != "" [#data.header.orderNumber] else [—],
      text(9pt, weight: "bold", fill: theme.mutedColor)[Return No.:], if "returnNumber" in data.header and data.header.returnNumber != none and data.header.returnNumber != "" [#data.header.returnNumber] else [—],
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

// ── Table: Debit Note Lines ────────────────────────────────────────────────
#table(
  columns: (2.4fr, 4.8fr, 0.8fr, 1.1fr, 0.8fr, 1.1fr),
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, left, center, right, right, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: theme.primaryColor)[Code],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Description],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Qty Credited],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Unit Price],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Tax],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Amount],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    (
      text(9pt)[#line.at("productNumber", default: "")],
      text(9pt)[#if desc != "" [#desc] else [—]],
      text(9pt, weight: "semibold", fill: theme.primaryColor)[#fmtQty(line.at("quantity", default: 0))],
      text(9pt)[#fmt(line.at("pricePerUnit", default: 0))],
      text(9pt)[#line.at("tax", default: 0)],
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
      [Subtotal:], [#data.header.currencyCode #fmt(data.summary.subtotal)],
      [Tax:], [#data.header.currencyCode #fmt(data.summary.totalTax)],
      ..(if "feeAmount" in data.summary and data.summary.feeAmount != none and data.summary.feeAmount != "" and float(data.summary.feeAmount) != 0.0 {
        ([Return Fees:], [-#data.header.currencyCode #fmt(data.summary.feeAmount)])
      } else { () }),
      
      grid.cell(colspan: 2)[#line(length: 100%, stroke: 0.5pt + theme.borderColor)],
      
      text(12pt, weight: "bold")[Total Debited:], 
      text(12pt, weight: "bold", fill: theme.accentColor)[#data.header.currencyCode #fmt(data.summary.totalAmount)],
    )
  ]
)

#v(2.5cm)

#text(8pt, fill: theme.mutedColor, style: "italic")[
  This debit note reduces the balance owed to the supplier. Please apply this credit to our account.
]
