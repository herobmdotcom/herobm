// Customer Statement of Account — herobm report template
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
#show: doc => conf(title: "STATEMENT OF ACCOUNT", doc)

#let theme = getTheme(data)

// ── Document Identity ───────────────────────────────────────────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 10pt,
  [
    #text(12pt, weight: "semibold", fill: theme.primaryColor)[Account: #data.header.customerNumber] \
    #if "state" in data.header and data.header.state != none and data.header.state != "" [
      #v(-0.1cm)
      #text(9pt, fill: theme.mutedColor)[Status: #data.header.state]
    ]
  ],
  align(right)[
    #text(9pt, fill: theme.mutedColor)[
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
    #text(9pt, weight: "bold", fill: theme.accentColor)[BILL TO] \
    #v(0.1cm)
    #text(11pt, weight: "semibold")[#data.header.customerName] \
    #if "billingAddress" in data.header and data.header.billingAddress != none and data.header.billingAddress != "" [
      #text(9pt, fill: theme.mutedColor)[#data.header.billingAddress] \
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
      text(9pt, weight: "bold", fill: theme.mutedColor)[Account No:], data.header.customerNumber,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Statement Date:], data.header.statementDate,
      text(9pt, weight: "bold", fill: theme.mutedColor)[Payment Terms:], if "paymentTerms" in data.header and data.header.paymentTerms != none and data.header.paymentTerms != "" [#data.header.paymentTerms] else [30 Days],
      text(9pt, weight: "bold", fill: theme.mutedColor)[Credit Limit:], if "creditLimit" in data.header and data.header.creditLimit != none and data.header.creditLimit != "" [#data.header.currencyCode #fmt(data.header.creditLimit)] else [—],
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

// ── Table: Statement Transactions ──────────────────────────────────────────
#let lines = if "lines" in data and data.lines != none { data.lines } else { () }
#table(
  columns: (1fr, 1.2fr, 1.4fr, 1.2fr, 1.2fr, 1.2fr, 1.4fr),
  inset: (x: 6pt, y: 8pt),
  stroke: 0.5pt + theme.borderColor,
  fill: (_, row) => if row == 0 { theme.tableHeaderFill },
  align: (left, left, left, left, right, right, right),
  
  // Header Row
  text(9pt, weight: "bold", fill: theme.primaryColor)[Date],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Type],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Doc Number],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Due Date],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Debit],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Credit],
  text(9pt, weight: "bold", fill: theme.primaryColor)[Balance],

  ..for line in lines {
    (
      text(9pt)[#line.at("date", default: "—")],
      text(9pt)[#line.at("type", default: "—")],
      text(9pt, weight: "medium", fill: theme.primaryColor)[#line.at("documentNumber", default: "—")],
      text(9pt)[#line.at("dueDate", default: "—")],
      text(9pt)[#if float(line.at("debit", default: 0)) != 0.0 [#fmt(line.debit)] else [—]],
      text(9pt)[#if float(line.at("credit", default: 0)) != 0.0 [#fmt(line.credit)] else [—]],
      text(9pt, weight: "medium", fill: theme.primaryColor)[#fmt(line.at("runningBalance", default: "0.00"))],
    )
  }
)

#v(0.8cm)

// ── Aged Balances Analysis & Total Due ──────────────────────────────────────
#grid(
  columns: (1fr),
  gutter: 10pt,
  [
    #text(10pt, weight: "bold", fill: theme.primaryColor)[AGED RECEIVABLES SUMMARY (#data.header.currencyCode)]
    #v(0.2cm)
    #table(
      columns: (1fr, 1fr, 1fr, 1fr, 1fr, 1.2fr),
      inset: (x: 6pt, y: 8pt),
      stroke: 0.5pt + theme.borderColor,
      fill: (_, row) => if row == 0 { theme.tableHeaderFill } else if row == 1 { rgb("#ffffff") },
      align: (center, center, center, center, center, center),

      text(8.5pt, weight: "bold", fill: theme.primaryColor)[Current],
      text(8.5pt, weight: "bold", fill: theme.primaryColor)[1–30 Days],
      text(8.5pt, weight: "bold", fill: theme.primaryColor)[31–60 Days],
      text(8.5pt, weight: "bold", fill: theme.primaryColor)[61–90 Days],
      text(8.5pt, weight: "bold", fill: theme.primaryColor)[90+ Days],
      text(9pt, weight: "bold", fill: theme.accentColor)[Total Due],

      text(9pt)[#fmt(data.aging.current)],
      text(9pt)[#fmt(data.aging.days1To30)],
      text(9pt)[#fmt(data.aging.days31To60)],
      text(9pt)[#fmt(data.aging.days61To90)],
      text(9pt)[#fmt(data.aging.days90Plus)],
      text(10pt, weight: "bold", fill: theme.accentColor)[#data.header.currencyCode #fmt(data.summary.totalOutstanding)],
    )
  ]
)

#v(0.8cm)

// ── Remittance / Payment Instructions ───────────────────────────────────────
#let bank = if "bank" in data and data.bank != none { data.bank } else { (:) }
#rect(
  width: 100%,
  stroke: 0.5pt + theme.borderColor,
  radius: 4pt,
  fill: theme.tableHeaderFill,
  inset: 12pt,
)[
  #grid(
    columns: (1fr, 1fr),
    gutter: 15pt,
    [
      #text(9pt, weight: "bold", fill: theme.primaryColor)[HOW TO PAY (DIRECT DEPOSIT / EFT)] \
      #v(0.1cm)
      #if "bankName" in bank and bank.bankName != none and bank.bankName != "" [
        #text(9pt)[Bank: #bank.bankName] \
      ]
      #if "accountName" in bank and bank.accountName != none and bank.accountName != "" [
        #text(9pt)[Account Name: #bank.accountName] \
      ]
      #if "bsb" in bank and bank.bsb != none and bank.bsb != "" [
        #text(9pt)[BSB / Routing: #bank.bsb] \
      ]
      #if "accountNumber" in bank and bank.accountNumber != none and bank.accountNumber != "" [
        #text(9pt)[Account No: #bank.accountNumber] \
      ]
    ],
    [
      #text(9pt, weight: "bold", fill: theme.primaryColor)[REMITTANCE ADVICE] \
      #v(0.1cm)
      #text(9pt)[Please quote Account No. *#data.header.customerNumber* when paying.] \
      #if "remittanceEmail" in bank and bank.remittanceEmail != none and bank.remittanceEmail != "" [
        #text(9pt)[Send remittances to: #bank.remittanceEmail]
      ]
    ]
  )
]
