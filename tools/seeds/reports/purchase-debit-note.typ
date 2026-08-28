// Purchase Debit Note — herobm report template
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
#show: doc => conf(title: "PURCHASE DEBIT NOTE", doc)

#set text(font: "DejaVu Sans", size: 10pt)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold")[#data.header.debitNoteNumber] \
    #if "state" in data.header and data.header.state != "" [
      #v(-0.1cm)
      #text(9pt, fill: luma(120))[Status: #data.header.state]
    ]
  ],
  align(right)[
    #text(9pt, fill: luma(100))[
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
    #text(9pt, weight: "bold", fill: luma(80))[SUPPLIER] \
    #v(0.1cm)
    #text(11pt, weight: "semibold")[#data.header.supplierName] \
    #if "supplierAddress" in data.header and data.header.supplierAddress != "" [
      #text(9pt, fill: luma(100))[#data.header.supplierAddress] \
    ]
    #if "supplierContact" in data.header and data.header.supplierContact != "" [
      #text(9pt, fill: luma(100))[Attn: #data.header.supplierContact]
    ]
  ],
  [
    #grid(
      columns: (auto, 1fr),
      row-gutter: 8pt,
      column-gutter: 12pt,
      text(9pt, weight: "bold", fill: luma(80))[Date:], data.header.debitNoteDate,
      text(9pt, weight: "bold", fill: luma(80))[Supplier Ref:], if "supplierReference" in data.header and data.header.supplierReference != "" [#data.header.supplierReference] else [—],
      text(9pt, weight: "bold", fill: luma(80))[PO Number:], if "orderNumber" in data.header and data.header.orderNumber != "" [#data.header.orderNumber] else [—],
      text(9pt, weight: "bold", fill: luma(80))[Return No.:], if "returnNumber" in data.header and data.header.returnNumber != "" [#data.header.returnNumber] else [—],
      text(9pt, weight: "bold", fill: luma(80))[Currency:], data.header.currencyCode,
    )
  ]
)

#v(1cm)

#if "customPdfText" in data and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(1cm)
] else if "quoteIntroText" in data and data.quoteIntroText != "" [
  #text(9pt)[#data.quoteIntroText]
  #v(1cm)
]

// ── Table: Debit Note Lines ────────────────────────────────────────────────
#table(
  columns: (1fr, 3fr, 0.8fr, 1.2fr, 0.8fr, 1.4fr),
  inset: (x: 8pt, y: 10pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: (left, left, right, right, center, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: luma(50))[Code],
  text(9pt, weight: "bold", fill: luma(50))[Description],
  text(9pt, weight: "bold", fill: luma(50))[Qty Credited],
  text(9pt, weight: "bold", fill: luma(50))[Unit Price],
  text(9pt, weight: "bold", fill: luma(50))[Tax],
  text(9pt, weight: "bold", fill: luma(50))[Amount],

  ..for line in data.lines {
    let desc = line.at("description", default: "")
    (
      text(9pt)[#line.at("productNumber", default: "")],
      text(9pt)[#if desc != "" [#desc] else [—]],
      text(9pt, weight: "semibold")[#line.at("quantity", default: 0)],
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
      ..(if "feeAmount" in data.summary and float(data.summary.feeAmount) != 0.0 {
        ([Return Fees:], [-#data.header.currencyCode #fmt(data.summary.feeAmount)])
      } else { () }),
      
      grid.cell(colspan: 2)[#line(length: 100%, stroke: 1pt + luma(230))],
      
      text(12pt, weight: "bold")[Total Debited:], 
      text(12pt, weight: "bold", fill: rgb("#1e3a5f"))[#data.header.currencyCode #fmt(data.summary.totalAmount)],
    )
  ]
)

#v(2.5cm)

#text(8pt, fill: luma(120), style: "italic")[
  This debit note reduces the balance owed to the supplier. Please apply this credit to our account.
]
