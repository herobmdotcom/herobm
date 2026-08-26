// Formal Period Close / Audit Snapshot — herobm report template
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

#let statusBadge(status) = {
  if status == "hard_closed" [
    #rect(fill: rgb("#ffe4e6"), inset: (x: 6pt, y: 3pt), radius: 3pt)[
      #text(8pt, weight: "bold", fill: rgb("#9f1239"))[HARD CLOSED (IMMUTABLE)]
    ]
  ] else if status == "soft_locked" [
    #rect(fill: rgb("#fef3c7"), inset: (x: 6pt, y: 3pt), radius: 3pt)[
      #text(8pt, weight: "bold", fill: rgb("#92400e"))[SOFT LOCKED]
    ]
  ] else [
    #rect(fill: rgb("#dcfce7"), inset: (x: 6pt, y: 3pt), radius: 3pt)[
      #text(8pt, weight: "bold", fill: rgb("#166534"))[OPEN PERIOD]
    ]
  ]
}

#let integrityBadge(isMatched) = {
  if isMatched [
    #text(8pt, weight: "bold", fill: rgb("#166534"))[✓ MATCHED]
  ] else [
    #text(8pt, weight: "bold", fill: rgb("#dc2626"))[✗ DISCREPANCY]
  ]
}

#import "theme-internal.typ": conf
#show: doc => conf(title: "AUDIT SNAPSHOT & PERIOD CLOSE", doc)

#set text(font: "DejaVu Sans", size: 9pt)

// ── Document Header ────────────────────────────────────────────────────────
#grid(
  columns: (1.3fr, 0.7fr),
  gutter: 15pt,
  [
    #text(13pt, weight: "bold", fill: rgb("#0f172a"))[FORMAL PERIOD CLOSE / AUDIT SNAPSHOT] \
    #v(2pt)
    #text(10pt, weight: "semibold", fill: rgb("#334155"))[Fiscal Period: #data.period.periodName (Period #data.period.periodNumber of FY#data.period.fiscalYear)] \
    #text(8.5pt, fill: luma(100))[Date Range: #data.period.startDate to #data.period.endDate]
  ],
  align(right)[
    #statusBadge(data.period.status) \
    #v(4pt)
    #text(8pt, fill: luma(100))[
      Base Currency: #data.header.baseCurrency \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.4cm)

// ── Company & Period Governance Summary ────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 15pt,
  [
    #rect(width: 100%, stroke: 0.5pt + luma(210), inset: 8pt, radius: 4pt, fill: rgb("#f8fafc"))[
      #text(8.5pt, weight: "bold", fill: luma(60))[ORGANIZATION ENTITY] \
      #v(3pt)
      #text(10pt, weight: "bold")[#data.header.orgName] \
      #if "orgTaxId" in data.header and data.header.orgTaxId != "" [
        #text(8pt, fill: luma(90))[Tax / Business ID: #data.header.orgTaxId] \
      ]
      #if "orgAddress" in data.header and data.header.orgAddress != "" [
        #text(8pt, fill: luma(90))[#data.header.orgAddress] \
      ]
      #if "orgEmail" in data.header and data.header.orgEmail != "" [
        #text(8pt, fill: luma(90))[Contact: #data.header.orgEmail]
      ]
    ]
  ],
  [
    #rect(width: 100%, stroke: 0.5pt + luma(210), inset: 8pt, radius: 4pt, fill: rgb("#f8fafc"))[
      #text(8.5pt, weight: "bold", fill: luma(60))[PERIOD GOVERNANCE & LOCK STATE] \
      #v(3pt)
      #grid(
        columns: (auto, 1fr),
        row-gutter: 4pt,
        column-gutter: 8pt,
        text(8pt, weight: "semibold")[Period Status:], text(8pt)[#data.period.status],
        text(8pt, weight: "semibold")[Closed By:], if "closedBy" in data.period and data.period.closedBy != none [#data.period.closedBy] else [—],
        text(8pt, weight: "semibold")[Closed At:], if "closedAt" in data.period and data.period.closedAt != none [#data.period.closedAt] else [—],
        text(8pt, weight: "semibold")[Locked By:], if "lockedBy" in data.period and data.period.lockedBy != none [#data.period.lockedBy] else [—],
      )
    ]
  ]
)

#if "customPdfText" in data and data.customPdfText != none and data.customPdfText != "" [
  #v(0.2cm)
  #rect(width: 100%, stroke: 0.5pt + rgb("#93c5fd"), inset: 6pt, radius: 4pt, fill: rgb("#eff6ff"))[
    #text(8.5pt, fill: rgb("#1e3a8a"))[#data.customPdfText]
  ]
]

#v(0.5cm)

// ── Section 1: Executive Balance Sheet & Income Summary ────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[1. Executive Financial Summary]
#v(0.1cm)

#grid(
  columns: (1fr, 1fr),
  gutter: 15pt,
  [
    #table(
      columns: (1.5fr, 1fr),
      inset: (x: 6pt, y: 5pt),
      stroke: 0.5pt + luma(220),
      fill: (_, row) => if row == 0 { rgb("#f1f5f9") } else if row == 4 { rgb("#f8fafc") },
      align: (left, right),
      text(8.5pt, weight: "bold")[Balance Sheet Position], text(8.5pt, weight: "bold")[As of #data.period.endDate],
      [Total Assets], [#data.header.baseCurrency #fmt(data.executiveSummary.totalAssets)],
      [Total Liabilities], [#data.header.baseCurrency #fmt(data.executiveSummary.totalLiabilities)],
      [Total Stated Equity], [#data.header.baseCurrency #fmt(data.executiveSummary.totalEquity)],
      text(weight: "bold")[Total Liab. & Retained Equity], text(weight: "bold")[#data.header.baseCurrency #fmt(data.executiveSummary.retainedEarningsAndNetIncome)],
    )
  ],
  [
    #table(
      columns: (1.5fr, 1fr),
      inset: (x: 6pt, y: 5pt),
      stroke: 0.5pt + luma(220),
      fill: (_, row) => if row == 0 { rgb("#f1f5f9") } else if row == 4 { rgb("#f8fafc") },
      align: (left, right),
      text(8.5pt, weight: "bold")[Income & Activity Summary], text(8.5pt, weight: "bold")[Period Activity],
      [Total Revenues (Period)], [#data.header.baseCurrency #fmt(data.executiveSummary.periodRevenue)],
      [Total Expenses (Period)], [#data.header.baseCurrency #fmt(data.executiveSummary.periodExpenses)],
      text(weight: "semibold")[Net Income (Period)], [#data.header.baseCurrency #fmt(data.executiveSummary.periodNetIncome)],
      text(weight: "bold")[Net Income (YTD)], text(weight: "bold")[#data.header.baseCurrency #fmt(data.executiveSummary.ytdNetIncome)],
    )
  ]
)

#v(0.4cm)

// ── Section 2: Continuous Subledger Parity & Audit Integrity ────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[2. Continuous Subledger Parity & Audit Verification]
#v(0.1cm)

#table(
  columns: (1.2fr, 1.8fr, 1.1fr, 1.1fr, 1fr, 1fr),
  inset: (x: 6pt, y: 5pt),
  stroke: 0.5pt + luma(220),
  fill: (_, row) => if row == 0 { rgb("#f1f5f9") },
  align: (left, left, right, right, right, center),
  
  // Header
  text(8pt, weight: "bold")[Control Account],
  text(8pt, weight: "bold")[Audit Scope / Subledger],
  text(8pt, weight: "bold")[GL Balance],
  text(8pt, weight: "bold")[Subledger],
  text(8pt, weight: "bold")[Drift / Diff],
  text(8pt, weight: "bold")[Status],

  // Rows
  [Trial Balance Zero-Sum], [Double-Entry Ledger Equality], [#fmt(data.subledgerIntegrity.trialBalanceZeroSum.totalDebit)], [#fmt(data.subledgerIntegrity.trialBalanceZeroSum.totalCredit)], [#fmt(data.subledgerIntegrity.trialBalanceZeroSum.netDifference)], integrityBadge(data.subledgerIntegrity.trialBalanceZeroSum.isBalanced),
  [AR (#data.subledgerIntegrity.accountsReceivable.controlAccountCode)], [Sales Invoices & Customer Receipts], [#fmt(data.subledgerIntegrity.accountsReceivable.glBalance)], [#fmt(data.subledgerIntegrity.accountsReceivable.subledgerBalance)], [#fmt(data.subledgerIntegrity.accountsReceivable.drift)], integrityBadge(data.subledgerIntegrity.accountsReceivable.isMatched),
  [AP (#data.subledgerIntegrity.accountsPayable.controlAccountCode)], [Purchase Invoices & Supplier Payments], [#fmt(data.subledgerIntegrity.accountsPayable.glBalance)], [#fmt(data.subledgerIntegrity.accountsPayable.subledgerBalance)], [#fmt(data.subledgerIntegrity.accountsPayable.drift)], integrityBadge(data.subledgerIntegrity.accountsPayable.isMatched),
  [GRNI (#data.subledgerIntegrity.goodsReceivedNotInvoiced.controlAccountCode)], [Goods Received Not Invoiced Clearing], [#fmt(data.subledgerIntegrity.goodsReceivedNotInvoiced.glBalance)], [#fmt(data.subledgerIntegrity.goodsReceivedNotInvoiced.subledgerBalance)], [#fmt(data.subledgerIntegrity.goodsReceivedNotInvoiced.drift)], integrityBadge(data.subledgerIntegrity.goodsReceivedNotInvoiced.isMatched),
  [Inventory (#data.subledgerIntegrity.perpetualInventory.controlAccountCode)], [Perpetual Stock Bin Contents], [#fmt(data.subledgerIntegrity.perpetualInventory.glBalance)], [#fmt(data.subledgerIntegrity.perpetualInventory.subledgerBalance)], [#fmt(data.subledgerIntegrity.perpetualInventory.drift)], integrityBadge(data.subledgerIntegrity.perpetualInventory.isMatched),
)

#v(0.5cm)

// ── Section 3: Classified Trial Balance Schedule ────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[3. Classified Trial Balance Schedule]
#v(0.1cm)

#table(
  columns: (0.9fr, 2.1fr, 0.9fr, 0.9fr, 0.9fr, 1.1fr, 1.1fr),
  inset: (x: 5pt, y: 4.5pt),
  stroke: 0.5pt + luma(225),
  fill: (_, row) => if row == 0 { rgb("#0f172a") },
  align: (left, left, right, right, right, right, right),
  
  // Header
  text(8pt, weight: "bold", fill: white)[Code],
  text(8pt, weight: "bold", fill: white)[Account Title],
  text(8pt, weight: "bold", fill: white)[Opening],
  text(8pt, weight: "bold", fill: white)[Period Dr],
  text(8pt, weight: "bold", fill: white)[Period Cr],
  text(8pt, weight: "bold", fill: white)[Closing Bal],
  text(8pt, weight: "bold", fill: white)[YTD Net],

  // Iterating Categories
  ..data.trialBalance.categories.map(cat => (
    // Category Header Span
    table.cell(colspan: 7, fill: rgb("#f1f5f9"))[
      #text(8.5pt, weight: "bold", fill: rgb("#1e293b"))[#cat.categoryName]
    ],
    // Category Rows
    ..cat.accounts.map(acc => (
      text(8pt, weight: "semibold")[#acc.accountCode],
      text(8pt)[#acc.name],
      text(8pt)[#fmt(acc.openingBalance)],
      text(8pt)[#fmt(acc.periodDebit)],
      text(8pt)[#fmt(acc.periodCredit)],
      text(8pt, weight: "semibold")[#fmt(acc.closingBalance)],
      text(8pt)[#fmt(acc.ytdBalance)],
    )).flatten(),
    // Category Subtotal
    table.cell(colspan: 2, fill: rgb("#f8fafc"))[
      #align(right)[#text(8pt, weight: "bold", fill: luma(60))[Subtotal #cat.categoryName:]]
    ],
    table.cell(fill: rgb("#f8fafc"))[#text(8pt, weight: "bold")[#fmt(cat.subtotal.openingBalance)]],
    table.cell(fill: rgb("#f8fafc"))[#text(8pt, weight: "bold")[#fmt(cat.subtotal.periodDebit)]],
    table.cell(fill: rgb("#f8fafc"))[#text(8pt, weight: "bold")[#fmt(cat.subtotal.periodCredit)]],
    table.cell(fill: rgb("#f8fafc"))[#text(8pt, weight: "bold")[#fmt(cat.subtotal.closingBalance)]],
    table.cell(fill: rgb("#f8fafc"))[#text(8pt, weight: "bold")[#fmt(cat.subtotal.ytdBalance)]],
  )).flatten(),

  // Grand Totals Row
  table.cell(colspan: 2, fill: rgb("#e2e8f0"))[
    #align(right)[#text(8.5pt, weight: "bold")[GRAND TOTALS:]]
  ],
  table.cell(fill: rgb("#e2e8f0"))[#text(8.5pt, weight: "bold")[#fmt(data.trialBalance.grandTotals.openingBalance)]],
  table.cell(fill: rgb("#e2e8f0"))[#text(8.5pt, weight: "bold")[#fmt(data.trialBalance.grandTotals.periodDebit)]],
  table.cell(fill: rgb("#e2e8f0"))[#text(8.5pt, weight: "bold")[#fmt(data.trialBalance.grandTotals.periodCredit)]],
  table.cell(fill: rgb("#e2e8f0"))[#text(8.5pt, weight: "bold")[#fmt(data.trialBalance.grandTotals.closingBalance)]],
  table.cell(fill: rgb("#e2e8f0"))[#text(8.5pt, weight: "bold")[#fmt(data.trialBalance.grandTotals.ytdBalance)]],
)

#v(0.5cm)

// ── Section 4: Period Governance & Audit Trail ──────────────────────────────
#if "timeline" in data and data.timeline.len() > 0 [
  #text(10pt, weight: "bold", fill: rgb("#0f172a"))[4. Period Lifecycle & Governance Audit Trail]
  #v(0.1cm)
  #table(
    columns: (1.5fr, 1.2fr, 1.2fr, 3fr),
    inset: (x: 6pt, y: 5pt),
    stroke: 0.5pt + luma(220),
    fill: (_, row) => if row == 0 { rgb("#f1f5f9") },
    align: (left, left, left, left),
    text(8pt, weight: "bold")[Timestamp],
    text(8pt, weight: "bold")[Event],
    text(8pt, weight: "bold")[Actor],
    text(8pt, weight: "bold")[Details / Remarks],
    ..data.timeline.map(evt => (
      text(8pt)[#evt.createdOn],
      text(8pt, weight: "semibold")[#evt.eventType],
      text(8pt)[#evt.actor],
      text(8pt)[#if "notes" in evt and evt.notes != none [#evt.notes] else if "entityDisplayName" in evt [#evt.entityDisplayName] else [—]],
    )).flatten()
  )
  #v(0.5cm)
]

// ── Section 5: Formal Auditor Certification & Sign-off ──────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[5. Formal Period Close Certification & Sign-off]
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
      #text(7.5pt, fill: luma(100))[Financial Controller / Senior Accountant]
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
    align(right)[#text(7.5pt, fill: luma(120))[Snapshot Timestamp: #data.certification.snapshotTimestamp]]
  )
]
