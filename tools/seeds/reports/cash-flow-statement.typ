// Statement of Cash Flows — herobm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))
#let fmt(val) = {
  if val == none or val == "" or val == "—" or str(val).trim() == "" { return "—" }
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

#import "theme-internal.typ": conf, getTheme
#show: doc => conf(title: "STATEMENT OF CASH FLOWS", doc)

#let theme = getTheme(data)

// ── Document Header ────────────────────────────────────────────────────────
#grid(
  columns: (1.3fr, 0.7fr),
  gutter: 15pt,
  [
    #text(13pt, weight: "bold", fill: theme.primaryColor)[STATEMENT OF CASH FLOWS] \
    #v(2pt)
    #text(10pt, weight: "semibold", fill: theme.mutedColor)[Period: #data.period.startDate to #data.period.endDate] \
    #if "periodName" in data.period and data.period.periodName != none and data.period.periodName != "" [
      #text(8.5pt, fill: theme.mutedColor)[Fiscal Period: #data.period.periodName]
    ]
  ],
  align(right)[
    #reconBadge(data.reconciliation.isReconciled) \
    #v(4pt)
    #text(8pt, fill: theme.mutedColor)[
      Base Currency: #data.header.baseCurrency \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.4cm)

// ── Company & Header Information ───────────────────────────────────────────
#rect(width: 100%, stroke: 0.5pt + theme.borderColor, inset: 8pt, radius: 4pt, fill: theme.tableHeaderFill)[
  #grid(
    columns: (1.2fr, 1fr),
    [
      #text(8.5pt, weight: "bold", fill: theme.mutedColor)[REPORTING ENTITY] \
      #v(2pt)
      #text(10pt, weight: "bold", fill: theme.primaryColor)[#data.header.orgName] \
      #if "orgTaxId" in data.header and data.header.orgTaxId != none and data.header.orgTaxId != "" [
        #text(8pt, fill: theme.mutedColor)[Tax / Business ID: #data.header.orgTaxId] \
      ]
      #if "orgAddress" in data.header and data.header.orgAddress != none and data.header.orgAddress != "" [
        #text(8pt, fill: theme.mutedColor)[#data.header.orgAddress]
      ]
    ],
    [
      #text(8.5pt, weight: "bold", fill: theme.mutedColor)[STATEMENT METRICS] \
      #v(2pt)
      #text(8pt)[Beginning Cash: *#data.header.baseCurrency #fmt(data.reconciliation.beginningCash)*] \
      #text(8pt)[Net Cash Change: *#data.header.baseCurrency #fmt(data.reconciliation.netChangeInCash)*] \
      #text(8pt)[Ending Cash: *#data.header.baseCurrency #fmt(data.reconciliation.endingCash)*]
    ]
  )
]

#if "customPdfText" in data and data.customPdfText != none and data.customPdfText != "" [
  #v(0.2cm)
  #rect(width: 100%, stroke: 0.5pt + theme.borderColor, inset: 6pt, radius: 4pt, fill: theme.tableHeaderFill)[
    #text(8.5pt, fill: theme.primaryColor)[#data.customPdfText]
  ]
]

#v(0.4cm)

// ── 1. Cash Flows from Operating Activities ────────────────────────────────
#text(10pt, weight: "bold", fill: theme.primaryColor)[1. Cash Flows from Operating Activities]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, right),
  text(8.5pt, weight: "bold", fill: theme.primaryColor)[Activity / Transaction Type],
  text(8.5pt, weight: "bold", fill: theme.primaryColor)[Amount (#data.header.baseCurrency)],

  ..data.operatingActivities.lines.map(line => (
    text(8pt)[#line.name],
    text(8pt)[#fmt(line.amount)],
  )).flatten(),

  table.cell(fill: theme.tableHeaderFill)[#text(8.5pt, weight: "bold", fill: theme.primaryColor)[Net Cash Provided by / (Used in) Operating Activities]],
  table.cell(fill: theme.tableHeaderFill)[#text(8.5pt, weight: "bold", fill: theme.primaryColor)[#fmt(data.operatingActivities.netCash)]],
)

#v(0.4cm)

// ── 2. Cash Flows from Investing Activities ────────────────────────────────
#text(10pt, weight: "bold", fill: theme.primaryColor)[2. Cash Flows from Investing Activities]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, right),
  text(8.5pt, weight: "bold", fill: theme.primaryColor)[Activity / Transaction Type],
  text(8.5pt, weight: "bold", fill: theme.primaryColor)[Amount (#data.header.baseCurrency)],

  ..data.investingActivities.lines.map(line => (
    text(8pt)[#line.name],
    text(8pt)[#fmt(line.amount)],
  )).flatten(),

  table.cell(fill: theme.tableHeaderFill)[#text(8.5pt, weight: "bold", fill: theme.primaryColor)[Net Cash Provided by / (Used in) Investing Activities]],
  table.cell(fill: theme.tableHeaderFill)[#text(8.5pt, weight: "bold", fill: theme.primaryColor)[#fmt(data.investingActivities.netCash)]],
)

#v(0.4cm)

// ── 3. Cash Flows from Financing Activities ────────────────────────────────
#text(10pt, weight: "bold", fill: theme.primaryColor)[3. Cash Flows from Financing Activities]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, right),
  text(8.5pt, weight: "bold", fill: theme.primaryColor)[Activity / Transaction Type],
  text(8.5pt, weight: "bold", fill: theme.primaryColor)[Amount (#data.header.baseCurrency)],

  ..data.financingActivities.lines.map(line => (
    text(8pt)[#line.name],
    text(8pt)[#fmt(line.amount)],
  )).flatten(),

  table.cell(fill: theme.tableHeaderFill)[#text(8.5pt, weight: "bold", fill: theme.primaryColor)[Net Cash Provided by / (Used in) Financing Activities]],
  table.cell(fill: theme.tableHeaderFill)[#text(8.5pt, weight: "bold", fill: theme.primaryColor)[#fmt(data.financingActivities.netCash)]],
)

#v(0.5cm)

// ── 4. Summary & Cash Reconciliation Schedule ──────────────────────────────
#text(10pt, weight: "bold", fill: theme.primaryColor)[4. Summary & Cash Reconciliation Schedule]
#v(0.1cm)

#table(
  columns: (3fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.primaryColor } else if row == 4 { theme.tableHeaderFill } else if row == 7 { theme.tableHeaderFill },
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
  text(8pt, style: "italic", fill: theme.mutedColor)[Reconciliation Difference / Drift], text(8pt, style: "italic", fill: theme.mutedColor)[#fmt(data.reconciliation.drift)],
)

#v(0.5cm)

// ── 5. Formal Sign-off & Certification Block ───────────────────────────────
#text(10pt, weight: "bold", fill: theme.primaryColor)[5. Statement Certification & Verification]
#v(0.1cm)

#rect(width: 100%, stroke: 0.5pt + theme.borderColor, inset: 10pt, radius: 4pt, fill: theme.tableHeaderFill)[
  #text(8.5pt, style: "italic", fill: theme.mutedColor)[
    "#data.certification.statement"
  ]
  #v(0.6cm)
  #grid(
    columns: (1fr, 1fr, 1fr),
    gutter: 20pt,
    [
      #line(length: 100%, stroke: 0.5pt + theme.borderColor)
      #v(2pt)
      #text(8pt, weight: "bold", fill: theme.primaryColor)[Prepared By: #data.certification.preparedBy] \
      #text(7.5pt, fill: theme.mutedColor)[Financial Controller / Accountant]
    ],
    [
      #line(length: 100%, stroke: 0.5pt + theme.borderColor)
      #v(2pt)
      #text(8pt, weight: "bold", fill: theme.primaryColor)[Reviewed By: #data.certification.reviewedBy] \
      #text(7.5pt, fill: theme.mutedColor)[Chief Financial Officer (CFO)]
    ],
    [
      #line(length: 100%, stroke: 0.5pt + theme.borderColor)
      #v(2pt)
      #text(8pt, weight: "bold", fill: theme.primaryColor)[Approved By: #data.certification.approvedBy] \
      #text(7.5pt, fill: theme.mutedColor)[Auditor / Board Representative]
    ]
  )
  #v(0.4cm)
  #line(length: 100%, stroke: 0.5pt + theme.borderColor)
  #v(2pt)
  #grid(
    columns: (1fr, 1fr),
    text(7.5pt, fill: theme.mutedColor)[Snapshot Verification Hash: #data.certification.snapshotHash],
    align(right)[#text(7.5pt, fill: theme.mutedColor)[Verification Timestamp: #data.certification.snapshotTimestamp]]
  )
]
