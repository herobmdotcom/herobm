// Customer Payment Receipt — herobm report template
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

#import "theme-customer.typ": conf, getTheme
#show: doc => conf(title: "PAYMENT RECEIPT", doc)

#let theme = getTheme(data)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold", fill: theme.primaryColor)[Receipt: #data.header.paymentNumber] \
    #if "state" in data.header and data.header.state != none and data.header.state != "" [
      #v(-0.1cm)
      #text(9pt, fill: theme.mutedColor)[Status: #data.header.state]
    ]
  ],
  align(right)[
    #text(9pt, fill: theme.mutedColor)[
      Payment Date: #data.header.paymentDate \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.8cm)

// ── Customer & Receipt Info ────────────────────────────────────────────────
#grid(
  columns: (1.2fr, 0.8fr),
  gutter: 20pt,
  [
    #text(9pt, weight: "bold", fill: theme.accentColor)[RECEIVED FROM] \
    #v(0.1cm)
    #text(11pt, weight: "semibold")[#data.header.customerName] \
    #if "customerNumber" in data.header and data.header.customerNumber != none and data.header.customerNumber != "" [
      #text(9pt, fill: theme.mutedColor)[Account: #data.header.customerNumber] \
    ]
    #if "customerAddress" in data.header and data.header.customerAddress != none and data.header.customerAddress != "" [
      #text(9pt, fill: theme.mutedColor)[#data.header.customerAddress] \
    ]
    #if "customerContact" in data.header and data.header.customerContact != none and data.header.customerContact != "" [
      #text(9pt, fill: theme.mutedColor)[Attn: #data.header.customerContact]
    ]
  ],
  [
    #grid(
      columns: (auto, 1fr),
      row-gutter: 8pt,
      column-gutter: 12pt,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Receipt No:], data.header.paymentNumber,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Payment Date:], data.header.paymentDate,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Payment Method:], if "modeOfPayment" in data.header and data.header.modeOfPayment != none and data.header.modeOfPayment != "" [#data.header.modeOfPayment] else [EFT],
      text(9pt, weight: "bold", fill: theme.mutedColor)[Reference:], if "referenceNumber" in data.header and data.header.referenceNumber != none and data.header.referenceNumber != "" [#data.header.referenceNumber] else [—],
      text(9pt, weight: "bold", fill: theme.mutedColor)[Currency:], data.header.currencyCode,
    )
  ]
)

#v(0.8cm)

#if "customPdfText" in data and data.customPdfText != none and data.customPdfText != "" [
  #text(9pt)[#data.customPdfText]
  #v(0.8cm)
] else if "quoteIntroText" in data and data.quoteIntroText != none and data.quoteIntroText != "" [
  #text(9pt)[#data.quoteIntroText]
  #v(0.8cm)
]

// ── Table: Settled Invoices ────────────────────────────────────────────────
#let lines = if "lines" in data and data.lines != none { data.lines } else { () }
#table(
  columns: (1fr, 1.2fr, 1.4fr, 1fr, 1.2fr, 1.1fr, 1.3fr),
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, left, left, left, right, right, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: theme.primaryColor)[Date],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Invoice No.],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Customer Ref],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Due Date],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Gross Amount],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Discount],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Amount Received],

  ..for line in lines {
    (
      text(9pt)[#line.at("invoiceDate", default: "—")],
      text(9pt, weight: "medium", fill: theme.primaryColor)[#line.at("invoiceNumber", default: "—")],
      text(9pt)[#line.at("customerOrderNumber", default: "—")],
      text(9pt)[#line.at("dueDate", default: "—")],
      text(9pt)[#fmt(line.at("grossAmount", default: "0.00"))],
      text(9pt)[#if float(line.at("discountAmount", default: 0)) > 0.0 [#fmt(line.discountAmount)] else [—]],
      text(9pt, weight: "semibold", fill: theme.primaryColor)[#fmt(line.at("allocatedAmount", default: "0.00"))],
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
      text(9pt, fill: theme.mutedColor)[Total Invoiced:], text(9pt)[#fmt(data.summary.totalGross)],
      text(9pt, fill: theme.mutedColor)[Total Discounts Applied:], text(9pt)[#if "totalDiscount" in data.summary and float(data.summary.totalDiscount) > 0.0 [-#fmt(data.summary.totalDiscount)] else [—]],
      ..(if "unallocatedAmount" in data.summary and data.summary.unallocatedAmount != none and data.summary.unallocatedAmount != "" and float(data.summary.unallocatedAmount) != 0.0 {
        (text(9pt, fill: theme.mutedColor)[Unallocated / Prepayment:], text(9pt)[#fmt(data.summary.unallocatedAmount)])
      } else { () }),
      grid.cell(colspan: 2)[#line(length: 100%, stroke: 0.5pt + theme.borderColor)],
      text(11pt, weight: "bold")[Total Received (#data.header.currencyCode):],
      text(11pt, weight: "bold", fill: theme.accentColor)[#data.header.currencyCode #fmt(data.summary.totalPaid)],
    )
  ]
]

#v(1cm)

// ── Payment Note ────────────────────────────────────────────────────
#rect(
  width: 100%,
  stroke: 0.5pt + theme.borderColor,
  radius: 4pt,
  fill: theme.tableHeaderFill,
  inset: 10pt,
)[
  #text(8.5pt, fill: theme.mutedColor)[
    *Thank you for your payment.* This official receipt confirms that funds have been received and credited to your account as detailed above. If you have any questions regarding this receipt, please contact our accounts department.
  ]
]
