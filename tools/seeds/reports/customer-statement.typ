// Customer Statement of Account — herobm report template
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
#show: doc => conf(title: "STATEMENT OF ACCOUNT", doc)

#set text(font: "DejaVu Sans", size: 10pt)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold")[Account: #data.header.customerNumber] \
    #if "state" in data.header and data.header.state != "" [
      #v(-0.1cm)
      #text(9pt, fill: luma(120))[Status: #data.header.state]
    ]
  ],
  align(right)[
    #text(9pt, fill: luma(100))[
      Statement Date: #data.header.statementDate \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.8cm)

// ── Customer & Account Details ─────────────────────────────────────────────
#grid(
  columns: (1.2fr, 0.8fr),
  gutter: 20pt,
  [
    #text(9pt, weight: "bold", fill: luma(80))[BILL TO] \
    #v(0.1cm)
    #text(11pt, weight: "semibold")[#data.header.customerName] \
    #if "billingAddress" in data.header and data.header.billingAddress != "" [
      #text(9pt, fill: luma(100))[#data.header.billingAddress] \
    ]
    #if "customerContact" in data.header and data.header.customerContact != "" [
      #text(9pt, fill: luma(100))[Attn: #data.header.customerContact]
    ]
  ],
  [
    #grid(
      columns: (auto, 1fr),
      row-gutter: 8pt,
      column-gutter: 12pt,
      text(9pt, weight: "bold", fill: luma(80))[Account No:], data.header.customerNumber,
      text(9pt, weight: "bold", fill: luma(80))[Statement Date:], data.header.statementDate,
      text(9pt, weight: "bold", fill: luma(80))[Payment Terms:], if "paymentTerms" in data.header and data.header.paymentTerms != "" [#data.header.paymentTerms] else [30 Days],
      text(9pt, weight: "bold", fill: luma(80))[Credit Limit:], if "creditLimit" in data.header and data.header.creditLimit != "" [#data.header.currencyCode #fmt(data.header.creditLimit)] else [—],
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

// ── Table: Statement Transactions ──────────────────────────────────────────
#table(
  columns: (1fr, 1.2fr, 1.4fr, 1.2fr, 1.2fr, 1.2fr, 1.4fr),
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + luma(210),
  fill: (_, row) => if row == 0 { rgb("#f8fafc") },
  align: (left, left, left, left, right, right, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: luma(50))[Date],
  text(9pt, weight: "bold", fill: luma(50))[Type],
  text(9pt, weight: "bold", fill: luma(50))[Doc Number],
  text(9pt, weight: "bold", fill: luma(50))[Due Date],
  text(9pt, weight: "bold", fill: luma(50))[Debit],
  text(9pt, weight: "bold", fill: luma(50))[Credit],
  text(9pt, weight: "bold", fill: luma(50))[Balance],

  ..for line in data.lines {
    (
      text(9pt)[#line.at("date", default: "—")],
      text(9pt)[#line.at("type", default: "—")],
      text(9pt, weight: "medium")[#line.at("documentNumber", default: "—")],
      text(9pt)[#line.at("dueDate", default: "—")],
      text(9pt)[#if line.at("debit", default: "0.00") != "0.00" [#fmt(line.debit)] else [—]],
      text(9pt)[#if line.at("credit", default: "0.00") != "0.00" [#fmt(line.credit)] else [—]],
      text(9pt, weight: "medium")[#fmt(line.at("runningBalance", default: "0.00"))],
    )
  }
)

#v(0.8cm)

// ── Aged Balances Analysis & Total Due ──────────────────────────────────────
#grid(
  columns: (1fr),
  gutter: 10pt,
  [
    #text(10pt, weight: "bold", fill: luma(60))[AGED RECEIVABLES SUMMARY (#data.header.currencyCode)]
    #v(0.2cm)
    #table(
      columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1.2fr),
      inset: (x: 6pt, y: 8pt),
      stroke: 0.5pt + luma(210),
      fill: (_, row) => if row == 0 { rgb("#f1f5f9") } else if row == 1 { rgb("#ffffff") },
      align: (center, center, center, center, center, center),

      text(8.5pt, weight: "bold", fill: luma(60))[Current],
      text(8.5pt, weight: "bold", fill: luma(60))[1–30 Days],
      text(8.5pt, weight: "bold", fill: luma(60))[31–60 Days],
      text(8.5pt, weight: "bold", fill: luma(60))[61–90 Days],
      text(8.5pt, weight: "bold", fill: luma(60))[90+ Days],
      text(9pt, weight: "bold", fill: rgb("#0f172a"))[Total Due],

      text(9pt)[#fmt(data.aging.current)],
      text(9pt)[#fmt(data.aging.days1To30)],
      text(9pt)[#fmt(data.aging.days31To60)],
      text(9pt)[#fmt(data.aging.days61To90)],
      text(9pt)[#fmt(data.aging.days90Plus)],
      text(10pt, weight: "bold", fill: rgb("#0f172a"))[#data.header.currencyCode #fmt(data.summary.totalOutstanding)],
    )
  ]
)

#v(0.8cm)

// ── Remittance / Payment Instructions ───────────────────────────────────────
#rect(
  width: 100%,
  stroke: 0.5pt + luma(200),
  radius: 4pt,
  fill: rgb("#f8fafc"),
  inset: 12pt,
)[
  #grid(
    columns: (1fr, 1fr),
    gutter: 15pt,
    [
      #text(9pt, weight: "bold", fill: luma(70))[HOW TO PAY (DIRECT DEPOSIT / EFT)] \
      #v(0.1cm)
      #if "bankName" in data.bank and data.bank.bankName != "" [
        #text(9pt)[Bank: #data.bank.bankName] \
      ]
      #if "accountName" in data.bank and data.bank.accountName != "" [
        #text(9pt)[Account Name: #data.bank.accountName] \
      ]
      #if "bsb" in data.bank and data.bank.bsb != "" [
        #text(9pt)[BSB / Routing: #data.bank.bsb] \
      ]
      #if "accountNumber" in data.bank and data.bank.accountNumber != "" [
        #text(9pt)[Account No: #data.bank.accountNumber] \
      ]
    ],
    [
      #text(9pt, weight: "bold", fill: luma(70))[REMITTANCE ADVICE] \
      #v(0.1cm)
      #text(9pt)[Please quote Account No. *#data.header.customerNumber* when paying.] \
      #if "remittanceEmail" in data.bank and data.bank.remittanceEmail != "" [
        #text(9pt)[Send remittances to: #data.bank.remittanceEmail]
      ]
    ]
  )
]
