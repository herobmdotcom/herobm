// Accounting Codes Cheat Sheet — herobm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))

#import "theme-internal.typ": conf
#show: doc => conf(title: "ACCOUNTING CODES CHEAT SHEET", doc)

#set text(font: "DejaVu Sans", size: 8.5pt)

// ── Document Header ────────────────────────────────────────────────────────
#grid(
  columns: (1.3fr, 0.7fr),
  gutter: 15pt,
  [
    #text(13pt, weight: "bold", fill: rgb("#0f172a"))[ACCOUNTING CODES CHEAT SHEET] \
    #v(2pt)
    #text(9.5pt, weight: "semibold", fill: rgb("#334155"))[Chart of Accounts, Cost Centers & Activities]
  ],
  align(right)[
    #text(8pt, fill: luma(100))[
      Base Currency: #data.header.baseCurrency \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.3cm)

// ── Company Header ─────────────────────────────────────────────────────────
#rect(width: 100%, stroke: 0.5pt + luma(210), inset: 6pt, radius: 4pt, fill: rgb("#f8fafc"))[
  #grid(
    columns: (1fr, 1fr),
    [
      #text(8pt, weight: "bold", fill: luma(60))[ORGANIZATION ENTITY] \
      #text(9pt, weight: "bold")[#data.header.orgName]
    ],
    align(right)[
      #if "orgTaxId" in data.header and data.header.orgTaxId != none and data.header.orgTaxId != "" [
        #text(7.5pt, fill: luma(90))[Tax ID: #data.header.orgTaxId] \
      ]
      #if "orgEmail" in data.header and data.header.orgEmail != none and data.header.orgEmail != "" [
        #text(7.5pt, fill: luma(90))[#data.header.orgEmail]
      ]
    ]
  )
]

#v(0.4cm)

// ── Section 1: Chart of Accounts ───────────────────────────────────────────
#text(10pt, weight: "bold", fill: rgb("#0f172a"))[1. Chart of Accounts]
#v(0.15cm)

#table(
  columns: (70pt, 1fr, 90pt),
  stroke: (x, y) => if y == 0 { (bottom: 1pt + rgb("#334155")) } else { (bottom: 0.3pt + luma(220)) },
  fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else if calc.odd(row) { rgb("#f8fafc") } else { none },
  inset: (x: 5pt, y: 3.5pt),
  align: (left, left, left),
  [#text(7.5pt, weight: "bold")[ACCOUNT CODE]],
  [#text(7.5pt, weight: "bold")[ACCOUNT NAME]],
  [#text(7.5pt, weight: "bold")[TYPE / CATEGORY]],
  ..data.coa.map(row => (
    [
      #text(font: "DejaVu Sans Mono", size: 8pt, weight: if row.isGroup { "bold" } else { "regular" })[#row.accountCode]
    ],
    [
      #h(row.depth * 10pt)
      #if row.isGroup [
        #text(size: 6.5pt, weight: "bold", fill: rgb("#475569"))[GROUP ]
      ]
      #text(size: 8pt, weight: if row.isGroup { "bold" } else { "regular" })[#row.name]
    ],
    [
      #text(size: 7.5pt, fill: rgb("#475569"))[#row.accountType]
    ]
  )).flatten()
)

#v(0.5cm)

// ── Section 2 & 3: Cost Centers & Activities side-by-side ──────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 15pt,
  [
    #text(10pt, weight: "bold", fill: rgb("#0f172a"))[2. Cost Centers]
    #v(0.15cm)
    #table(
      columns: (50pt, 1fr, 50pt),
      stroke: (x, y) => if y == 0 { (bottom: 1pt + rgb("#334155")) } else { (bottom: 0.3pt + luma(220)) },
      fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else if calc.odd(row) { rgb("#f8fafc") } else { none },
      inset: (x: 4pt, y: 3.5pt),
      align: (left, left, center),
      [#text(7pt, weight: "bold")[CODE]],
      [#text(7pt, weight: "bold")[NAME]],
      [#text(7pt, weight: "bold")[STATUS]],
      ..data.costCenters.map(cc => (
        [#text(font: "DejaVu Sans Mono", size: 7.5pt)[#cc.code]],
        [#text(size: 7.5pt)[#cc.name]],
        [
          #if cc.isActive [
            #text(size: 6.5pt, weight: "bold", fill: rgb("#166534"))[Active]
          ] else [
            #text(size: 6.5pt, fill: rgb("#94a3b8"))[Inactive]
          ]
        ]
      )).flatten()
    )
  ],
  [
    #text(10pt, weight: "bold", fill: rgb("#0f172a"))[3. Activities]
    #v(0.15cm)
    #table(
      columns: (50pt, 1fr, 50pt),
      stroke: (x, y) => if y == 0 { (bottom: 1pt + rgb("#334155")) } else { (bottom: 0.3pt + luma(220)) },
      fill: (col, row) => if row == 0 { rgb("#f1f5f9") } else if calc.odd(row) { rgb("#f8fafc") } else { none },
      inset: (x: 4pt, y: 3.5pt),
      align: (left, left, center),
      [#text(7pt, weight: "bold")[CODE]],
      [#text(7pt, weight: "bold")[NAME]],
      [#text(7pt, weight: "bold")[STATUS]],
      ..data.activities.map(act => (
        [#text(font: "DejaVu Sans Mono", size: 7.5pt)[#act.code]],
        [#text(size: 7.5pt)[#act.name]],
        [
          #if act.isActive [
            #text(size: 6.5pt, weight: "bold", fill: rgb("#166534"))[Active]
          ] else [
            #text(size: 6.5pt, fill: rgb("#94a3b8"))[Inactive]
          ]
        ]
      )).flatten()
    )
  ]
)
