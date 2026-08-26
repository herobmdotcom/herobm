// Statement of Cash Flows — herobm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))
#let fmt(val) = {
  if val == none { return "—" }
  let n = float(val)
  let isNeg = n < 0.0
  let absVal = calc.abs(n)
  let s = str(calc.round(absVal, digits: 2))
  let parts = s.split(".")
  let formatted = if parts.len() == 1 {
    s + ".00"
  } else if parts.at(1).len() == 1 {
    s + "0"
  } else {
    s
  }
  if isNeg {
    "(" + formatted + ")"
  } else {
    formatted
  }
}

#let reconBadge(isReconciled) = {
  if isReconciled [
    #rect(fill: rgb("#dcfce7"), inset: (x: 6pt, y: 3pt), radius: 3pt)[
      #text(8pt, weight: "bold", fill: rgb("#166534"))[✓ RECONCILED WITH GL]
    ]
  ] else [
    #rect(fill: rgb("#fee2e2"), inset: (x: 6pt, y: 3pt), radius: 3pt)[
      #text(8pt, weight: "bold", fill: rgb("#b91c1c"))[✗ DISCREPANCY DETECTED]
    ]
  ]
}

#import "theme-internal.typ": conf
#show: doc => conf(title: "STATEMENT OF CASH FLOWS", doc)

#set text(font: "DejaVu Sans", size: 9pt)

// ── Document Header ────────────────────────────────────────────────────────
#grid(
  columns: (1.3fr, 0.7fr),
  gutter: 15pt,
  [
    #text(13pt, weight: "bold", fill: rgb("#0f172a"))[STATEMENT OF CASH FLOWS] \
    #v(2pt)
    #text(10pt, weight: "semibold", fill: rgb("#334155"))[Period: #data.period.startDate to #data.period.endDate] \
    #if "periodName" in data.period and data.period.periodName != none and data.period.periodName != "" [
      #text(8.5pt, fill: luma(100))[Fiscal Period: #data.period.periodName]
    ]
  ],
  align(right)[
    #reconBadge(data.reconciliation.isReconciled) \
    #v(4pt)
    #text(8pt, fill: luma(100))[
      Base Currency: #data.header.baseCurrency \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.4cm)

// ── Company & Header Information ───────────────────────────────────────────
#rect(width: 100%, stroke: 0.5pt + luma(210), inset: 8pt, radius: 4pt, fill: rgb("#f8fafc"))[
  #grid(
    columns: (1.2fr, 1fr),
    [
      #text(8.5pt, weight: "bold", fill: luma(60))[REPORTING ENTITY] \
      #v(2pt)
      #text(10pt, weight: "bold")[#data.header.orgName] \
      #if "orgTaxId" in data.header and data.header.orgTaxId != none and data.header.orgTaxId != "" [
        #text(8pt, fill: luma(90))[Tax / Business ID: #data.header.orgTaxId] \
      ]
      #if "orgAddress" in data.header and data.header.orgAddress != none and data.header.orgAddress != "" [
        #text(8pt, fill: luma(90))[#data.header.orgAddress]
      ]
    ],
    [
      #text(8.5pt, weight: "bold", fill: luma(60))[STATEMENT METRICS] \
      #v(2pt)
      #text(8pt)[Beginning Cash: *#data.header.baseCurrency #fmt(data.reconciliation.beginningCash)*] \
      #text(8pt)[Net Cash Change: *#data.header.baseCurrency #fmt(data.reconciliation.netChangeInCash)*] \
      #text(8pt)[Ending Cash: *#data.header.baseCurrency #fmt(data.reconciliation.endingCash)*]
    ]
  )
]

#if "customPdfText" in data and data.customPdfText != none and data.customPdfText != "" [
  #v(0.2cm)
  #rect(width: 100%, stroke: 0.5pt + rgb("#93c5fd"), inset: 6pt, radius: 4pt, fill: rgb("#eff6ff"))[
    #text(8.5pt, fill: rgb("#1e3a8a"))[#data.customPdfText]
  ]
]

#v(0.4cm)

// ── 1. Cash Flows from Operating Activities ────────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[1. Cash Flows from Operating Activities]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + luma(220),
  fill: (_, row) => if row == 0 { rgb("#f1f5f9") },
  align: (left, right),
  text(8.5pt, weight: "bold")[Activity / Transaction Type],
  text(8.5pt, weight: "bold")[Amount (#data.header.baseCurrency)],

  ..data.operatingActivities.lines.map(line => (
    text(8pt)[#line.name],
    text(8pt)[#fmt(line.amount)],
  )).flatten(),

  table.cell(fill: rgb("#f8fafc"))[#text(8.5pt, weight: "bold")[Net Cash Provided by / (Used in) Operating Activities]],
  table.cell(fill: rgb("#f8fafc"))[#text(8.5pt, weight: "bold")[#fmt(data.operatingActivities.netCash)]],
)

#v(0.4cm)

// ── 2. Cash Flows from Investing Activities ────────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[2. Cash Flows from Investing Activities]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + luma(220),
  fill: (_, row) => if row == 0 { rgb("#f1f5f9") },
  align: (left, right),
  text(8.5pt, weight: "bold")[Activity / Transaction Type],
  text(8.5pt, weight: "bold")[Amount (#data.header.baseCurrency)],

  ..data.investingActivities.lines.map(line => (
    text(8pt)[#line.name],
    text(8pt)[#fmt(line.amount)],
  )).flatten(),

  table.cell(fill: rgb("#f8fafc"))[#text(8.5pt, weight: "bold")[Net Cash Provided by / (Used in) Investing Activities]],
  table.cell(fill: rgb("#f8fafc"))[#text(8.5pt, weight: "bold")[#fmt(data.investingActivities.netCash)]],
)

#v(0.4cm)

// ── 3. Cash Flows from Financing Activities ────────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[3. Cash Flows from Financing Activities]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + luma(220),
  fill: (_, row) => if row == 0 { rgb("#f1f5f9") },
  align: (left, right),
  text(8.5pt, weight: "bold")[Activity / Transaction Type],
  text(8.5pt, weight: "bold")[Amount (#data.header.baseCurrency)],

  ..data.financingActivities.lines.map(line => (
    text(8pt)[#line.name],
    text(8pt)[#fmt(line.amount)],
  )).flatten(),

  table.cell(fill: rgb("#f8fafc"))[#text(8.5pt, weight: "bold")[Net Cash Provided by / (Used in) Financing Activities]],
  table.cell(fill: rgb("#f8fafc"))[#text(8.5pt, weight: "bold")[#fmt(data.financingActivities.netCash)]],
)

#v(0.5cm)

// ── 4. Summary & Cash Reconciliation Schedule ──────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[4. Summary & Cash Reconciliation Schedule]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + luma(220),
  fill: (_, row) => if row == 0 { rgb("#0f172a") } else if row == 4 { rgb("#f1f5f9") } else if row == 7 { rgb("#f8fafc") },
  align: (left, right),
  text(8.5pt, weight: "bold", fill: white)[Reconciliation Metric],
  text(8.5pt, weight: "bold", fill: white)[Amount (#data.header.baseCurrency)],

  [Net Operating Cash Flow], [#fmt(data.operatingActivities.netCash)],
  [Net Investing Cash Flow], [#fmt(data.investingActivities.netCash)],
  [Net Financing Cash Flow], [#fmt(data.financingActivities.netCash)],
  text(8.5pt, weight: "bold")[Net Increase / (Decrease) in Cash and Cash Equivalents], text(8.5pt, weight: "bold")[#fmt(data.reconciliation.netChangeInCash)],
  [Cash and Cash Equivalents at Beginning of Period], [#fmt(data.reconciliation.beginningCash)],
  text(8.5pt, weight: "bold")[Cash and Cash Equivalents at End of Period (Calculated)], text(8.5pt, weight: "bold")[#fmt(data.reconciliation.endingCash)],
  [General Ledger Bank & Cash Control Account Balance], [#fmt(data.reconciliation.glCashBalance)],
  text(8pt, style: "italic")[Reconciliation Difference / Drift], text(8pt, style: "italic")[#fmt(data.reconciliation.drift)],
)

#v(0.5cm)

// ── 5. Formal Sign-off & Certification Block ───────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[5. Statement Certification & Verification]
#v(0.1cm)

#rect(width: 100%, stroke: 0.5pt + luma(200), inset: 10pt, radius: 4pt, fill: rgb("#fafafa"))[
  #text(8.5pt, style: "italic", fill: rgb("#334155"))[
    "#data.certification.statement"
  ]
  #v(0.6cm)
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 20pt,
    [
      #line(length: 100%, stroke: 0.5pt + luma(180))
      #v(2pt)
      #text(8pt, weight: "bold")[Prepared By: #data.certification.preparedBy] \
      #text(7.5pt, fill: luma(100))[Financial Controller / Accountant]
    ],
    [
      #line(length: 100%, stroke: 0.5pt + luma(180))
      #v(2pt)
      #text(8pt, weight: "bold")[Reviewed By: #data.certification.reviewedBy] \
      #text(7.5pt, fill: luma(100))[Chief Financial Officer (CFO)]
    ],
    [
      #line(length: 100%, stroke: 0.5pt + luma(180))
      #v(2pt)
      #text(8pt, weight: "bold")[Approved By: #data.certification.approvedBy] \
      #text(7.5pt, fill: luma(100))[Auditor / Board Representative]
    ]
  )
  #v(0.4cm)
  #line(length: 100%, stroke: 0.5pt + luma(220))
  #v(2pt)
  #grid(
    columns: (1fr, 1fr),
    text(7.5pt, fill: luma(120))[Snapshot Verification Hash: #data.certification.snapshotHash],
    align(right)[#text(7.5pt, fill: luma(120))[Verification Timestamp: #data.certification.snapshotTimestamp]]
  )
]
