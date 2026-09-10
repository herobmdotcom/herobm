#import "theme-internal.typ": conf, getTheme
#show: doc => conf(title: "Picking Slip", doc)

#let data = json(sys.inputs.at("data"))
#let theme = getTheme(data)

// ── Header ──────────────────────────────────────────────────────────────────
#align(center)[
  #text(16pt, weight: "bold", fill: theme.primaryColor)[Picking Slip]
]
#v(0.5cm)

#grid(
  columns: (1fr, 1fr),
  row-gutter: 8pt,
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Order:] #text(10pt, weight: "semibold", fill: theme.primaryColor)[#data.header.orderNumber]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Customer:] #text(10pt, weight: "semibold")[#data.header.customerName]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Customer PO:] #if "customerOrderNumber" in data.header and data.header.customerOrderNumber != "" and data.header.customerOrderNumber != none [#data.header.customerOrderNumber] else [—]],
  [#text(9pt, weight: "bold", fill: theme.mutedColor)[Date:] #data.header.orderDate],
)

#v(0.8cm)

// ── Table 1: Items to Pick ──────────────────────────────────────────────────
#grid(
  columns: (1fr, auto),
  align: (left, right),
  [#text(12pt, weight: "bold", fill: theme.primaryColor)[Items to Pick]],
  [#text(10pt, style: "italic", fill: theme.mutedColor)[Location: #if "locationName" in data.header and data.header.locationName != none and data.header.locationName != "" [#data.header.locationName] else [Main Warehouse]]]
)
#v(0.3cm)

#let fmtQty(val) = {
  if val == none or val == "" or val == "—" or str(val).trim() == "" { return "0" }
  let n = float(val)
  if calc.round(n) == n {
    str(int(n))
  } else {
    str(calc.round(n, digits: 4))
  }
}

#let pickingLines = if "pickingLines" in data and data.pickingLines != none { data.pickingLines } else { () }
#if pickingLines.len() > 0 {
  table(
    columns: (2.2fr, 4fr, 1.2fr, 0.8fr),
    inset: (x: 8pt, y: 8pt),
    stroke: 0.5pt + theme.borderColor,
    fill: (_, row) => if row == 0 { theme.tableHeaderFill },
    align: (left, left, left, right),
    text(9pt, weight: "bold", fill: theme.primaryColor)[Product Code],
    text(9pt, weight: "bold", fill: theme.primaryColor)[Description],
    text(9pt, weight: "bold", fill: theme.primaryColor)[Bin],
    text(9pt, weight: "bold", fill: theme.primaryColor)[Qty to Pick],
    ..for line in pickingLines {
      (
        text(9pt, weight: "semibold")[#line.at("productCode", default: "—")],
        text(9pt)[#line.at("description", default: "—")],
        text(9pt)[#line.at("binNumber", default: "—")],
        text(9pt, weight: "bold", fill: theme.primaryColor)[#fmtQty(line.at("qtyToPick", default: 0))]
      )
    }
  )
} else {
  emph[No items to pick — all lines are already picked.]
}

