// Supplier Remittance Advice — herobm report template
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
#show: doc => conf(title: "REMITTANCE ADVICE", doc)

#set text(font: "DejaVu Sans", size: 10pt)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold")[Payment: #data.header.paymentNumber] \
    #if "state" in data.header and data.header.state != "" [
      #v(-0.1cm)
      #text(9pt, fill: luma(120))[Status: #data.header.state]
    ]
  ],
  align(right)[
    #text(9pt, fill: luma(100))[
      Payment Date: #data.header.paymentDate \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.8cm)

// ── Supplier & Payment Info ────────────────────────────────────────────────
#grid(
  columns: (1.2fr, 0.8fr),
  gutter: 20pt,
  [
    #text(9pt, weight: "bold", fill: luma(80))[PAYEE / SUPPLIER] \
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
      text(9pt, weight: "bold", fill: luma(80))[Payment No:], data.header.paymentNumber,
      text(9pt, weight: "bold", fill: luma(80))[Payment Date:], data.header.paymentDate,
      text(9pt, weight: "bold", fill: luma(80))[Payment Method:], if "modeOfPayment" in data.header and data.header.modeOfPayment != "" [#data.header.modeOfPayment] else [EFT],
      text(9pt, weight: "bold", fill: luma(80))[Reference:], if "referenceNumber" in data.header and data.header.referenceNumber != "" [#data.header.referenceNumber] else [—],
      text(9pt, weight: "bold", fill: luma(80))[Currency:], data.header.currencyCode,
    )
  ]
)

#v(0.8cm)

#if "customPdfText" in data and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(0.8cm)
] else if "quoteIntroText" in data and data.quoteIntroText != "" [
  #text(9pt)[#data.quoteIntroText]
  #v(0.8cm)
]

// ── Table: Settled Invoices ────────────────────────────────────────────────
#table(
  columns: (1fr, 1.2fr, 1.4fr, 1fr, 1.2fr, 1.1fr, 1.3fr),
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: (left, left, left, left, right, right, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: luma(50))[Date],
  text(9pt, weight: "bold", fill: luma(50))[Invoice #],
  text(9pt, weight: "bold", fill: luma(50))[Supplier Ref],
  text(9pt, weight: "bold", fill: luma(50))[Due Date],
  text(9pt, weight: "bold", fill: luma(50))[Gross Amount],
  text(9pt, weight: "bold", fill: luma(50))[Discount],
  text(9pt, weight: "bold", fill: luma(50))[Amount Paid],

  ..for line in data.lines {
    (
      text(9pt)[#line.at("invoiceDate", default: "—")],
      text(9pt, weight: "medium")[#line.at("invoiceNumber", default: "—")],
      text(9pt)[#line.at("supplierInvoiceNumber", default: "—")],
      text(9pt)[#line.at("dueDate", default: "—")],
      text(9pt)[#fmt(line.at("grossAmount", default: "0.00"))],
      text(9pt)[#if line.at("discountAmount", default: "0.00") != "0.00" [#fmt(line.discountAmount)] else [—]],
      text(9pt, weight: "semibold")[#fmt(line.at("allocatedAmount", default: "0.00"))],
    )
  }
)

#v(0.8cm)

// ── Summary & Totals ───────────────────────────────────────────────────────
#align(right)[
  #block(width: 50%)[
    #grid(
      columns: (1fr, 1fr),
      row-gutter: 8pt,
      align: (left, right),
      text(9pt, fill: luma(100))[Total Invoiced:], text(9pt)[#fmt(data.summary.totalGross)],
      text(9pt, fill: luma(100))[Total Discounts Applied:], text(9pt)[#if data.summary.totalDiscount != "0.00" [-#fmt(data.summary.totalDiscount)] else [—]],
      #if "unallocatedAmount" in data.summary and data.summary.unallocatedAmount != "0.00" [
        #text(9pt, fill: luma(100))[Unallocated / Prepayment:], #text(9pt)[#fmt(data.summary.unallocatedAmount)]
      ],
      line(length: 100%, stroke: 0.5pt + luma(200)),
      line(length: 100%, stroke: 0.5pt + luma(200)),
      text(11pt, weight: "bold")[Total Paid (#data.header.currencyCode):],
      text(11pt, weight: "bold")[#data.header.currencyCode #fmt(data.summary.totalPaid)],
    )
  ]
]

#v(1cm)

// ── Payment Note ────────────────────────────────────────────────────────────
#rect(
  width: 100%,
  stroke: 0.5pt + luma(200),
  radius: 4pt,
  fill: rgb("#f8fafc"),
  inset: 10pt,
)[
  #text(8.5pt, fill: luma(90))[
    *Note:* This payment has been processed and remitted to your designated bank account according to our agreed terms. If you have any inquiries regarding this remittance advice, please contact our accounts department.
  ]
]
