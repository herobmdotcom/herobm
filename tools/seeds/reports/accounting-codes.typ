// Accounting Codes Cheat Sheet — herobm report template
// Data is loaded from a JSON file passed via sys.inputs.data

#let data = json(sys.inputs.at("data"))

#import "theme-internal.typ": conf, getTheme
#show: doc => conf(title: "ACCOUNTING CODES CHEAT SHEET", doc)

#let theme = getTheme(data)

// ── Document Header ────────────────────────────────────────────────────────
#grid(
  columns: (1.3fr, 0.7fr),
  gutter: 15pt,
  [
    #text(13pt, weight: "bold", fill: theme.primaryColor)[ACCOUNTING CODES CHEAT SHEET] \
    #v(2pt)
    #text(9.5pt, weight: "semibold", fill: theme.mutedColor)[Chart of Accounts, Cost Centers & Activities]
  ],
  align(right)[
    #text(8pt, fill: theme.mutedColor)[
      Base Currency: #data.header.baseCurrency \
      Generated: #data.generatedAt
    ]
  ]
)

#v(0.3cm)

// ── Company Header ─────────────────────────────────────────────────────────
#rect(width: 100%, stroke: 0.5pt + theme.borderColor, inset: 6pt, radius: 4pt, fill: theme.tableHeaderFill)[
  #grid(
    columns: (1fr, 1fr),
    [
      #text(8pt, weight: "bold", fill: theme.mutedColor)[ORGANIZATION ENTITY] \
      #text(9pt, weight: "bold", fill: theme.primaryColor)[#data.header.orgName]
    ],
    align(right)[
      #if "orgTaxId" in data.header and data.header.orgTaxId != none and data.header.orgTaxId != "" [
        #text(7.5pt, fill: theme.mutedColor)[Tax ID: #data.header.orgTaxId] \
      ]
      #if "orgEmail" in data.header and data.header.orgEmail != none and data.header.orgEmail != "" [
        #text(7.5pt, fill: theme.mutedColor)[#data.header.orgEmail]
      ]
    ]
  )
]

#v(0.4cm)

// ── Section 1: Chart of Accounts ───────────────────────────────────────────
#text(10pt, weight: "bold", fill: theme.primaryColor)[1. Chart of Accounts]
#v(0.15cm)

#table(
  columns: (70pt, 1fr, 90pt),
  stroke: (x, y) => if y == 0 { (bottom: 1pt + theme.primaryColor) } else { (bottom: 0.3pt + theme.borderColor) },
  fill: (col, row) => if row == 0 { theme.tableHeaderFill } else { none },
  inset: (x: 5pt, y: 3.5pt),
  align: (left, left, left),
  [#text(7.5pt, weight: "bold", fill: theme.primaryColor)[ACCOUNT CODE]],
  [#text(7.5pt, weight: "bold", fill: theme.primaryColor)[ACCOUNT NAME]],
  [#text(7.5pt, weight: "bold", fill: theme.primaryColor)[TYPE / CATEGORY]],
  ..data.coa.map(row => (
    [
      #text(font: "DejaVu Sans Mono", size: 8pt, weight: if row.isGroup { "bold" } else { "regular" }, fill: theme.primaryColor)[#row.accountCode]
    ],
    [
      #h(row.depth * 10pt)
      #if row.isGroup [
        #text(size: 6.5pt, weight: "bold", fill: theme.mutedColor)[GROUP ]
      ]
      #text(size: 8pt, weight: if row.isGroup { "bold" } else { "regular" })[#row.name]
    ],
    [
      #text(size: 7.5pt, fill: theme.mutedColor)[#row.accountType]
    ]
  )).flatten()
)

#v(0.5cm)

// ── Section 2 & 3: Cost Centers & Activities side-by-side ──────────────────
#grid(
  columns: (1fr, 1fr),
  gutter: 15pt,
  [
    #text(10pt, weight: "bold", fill: theme.primaryColor)[2. Cost Centers]
    #v(0.15cm)
    #table(
      columns: (50pt, 1fr, 50pt),
      stroke: (x, y) => if y == 0 { (bottom: 1pt + theme.primaryColor) } else { (bottom: 0.3pt + theme.borderColor) },
      fill: (col, row) => if row == 0 { theme.tableHeaderFill } else { none },
      inset: (x: 4pt, y: 3.5pt),
      align: (left, left, center),
      [#text(7pt, weight: "bold", fill: theme.primaryColor)[CODE]],
      [#text(7pt, weight: "bold", fill: theme.primaryColor)[NAME]],
      [#text(7pt, weight: "bold", fill: theme.primaryColor)[STATUS]],
      ..data.costCenters.map(cc => (
        [#text(font: "DejaVu Sans Mono", size: 7.5pt, fill: theme.primaryColor)[#cc.code]],
        [#text(size: 7.5pt)[#cc.name]],
        [
          #if cc.isActive [
            #text(size: 6.5pt, weight: "bold", fill: rgb("#166534"))[Active]
          ] else [
            #text(size: 6.5pt, fill: theme.mutedColor)[Inactive]
          ]
        ]
      )).flatten()
    )
  ],
  [
    #text(10pt, weight: "bold", fill: theme.primaryColor)[3. Activities]
    #v(0.15cm)
    #table(
      columns: (50pt, 1fr, 50pt),
      stroke: (x, y) => if y == 0 { (bottom: 1pt + theme.primaryColor) } else { (bottom: 0.3pt + theme.borderColor) },
      fill: (col, row) => if row == 0 { theme.tableHeaderFill } else { none },
      inset: (x: 4pt, y: 3.5pt),
      align: (left, left, center),
      [#text(7pt, weight: "bold", fill: theme.primaryColor)[CODE]],
      [#text(7pt, weight: "bold", fill: theme.primaryColor)[NAME]],
      [#text(7pt, weight: "bold", fill: theme.primaryColor)[STATUS]],
      ..data.activities.map(act => (
        [#text(font: "DejaVu Sans Mono", size: 7.5pt, fill: theme.primaryColor)[#act.code]],
        [#text(size: 7.5pt)[#act.name]],
        [
          #if act.isActive [
            #text(size: 6.5pt, weight: "bold", fill: rgb("#166534"))[Active]
          ] else [
            #text(size: 6.5pt, fill: theme.mutedColor)[Inactive]
          ]
        ]
      )).flatten()
    )
  ]
)
