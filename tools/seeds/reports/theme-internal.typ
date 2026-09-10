#let get(dict, key, default: none) = {
  if dict == none { return default }
  let val = dict.at(key, default: default)
  if val == none or val == "" { default } else { val }
}

#let getTheme(orgData) = {
  let org = get(orgData, "_org", default: (:))
  let cfg = get(org, "pdfThemeConfig", default: (:))

  let fontCustom = get(cfg, "fontFamily")
  let fontFamily = if fontCustom != none {
    (fontCustom, "DejaVu Sans", "Liberation Sans", "Helvetica", "Arial")
  } else {
    ("DejaVu Sans", "Liberation Sans", "Helvetica", "Arial")
  }
  let baseFontSize = float(get(cfg, "baseFontSizePt", default: 10)) * 1pt
  let primaryColor = rgb(get(cfg, "primaryColor", default: "#1e3a5f"))
  let accentColor = rgb(get(cfg, "accentColor", default: "#2563eb"))

  let mutedColor = if get(cfg, "mutedColor") != none { rgb(cfg.mutedColor) } else { primaryColor.lighten(30%) }
  let borderColor = if get(cfg, "borderColor") != none { rgb(cfg.borderColor) } else { primaryColor.lighten(75%) }
  let tableHeaderFill = if get(cfg, "tableHeaderFill") != none { rgb(cfg.tableHeaderFill) } else { primaryColor.lighten(94%) }

  (
    fontFamily: fontFamily,
    baseFontSize: baseFontSize,
    primaryColor: primaryColor,
    accentColor: accentColor,
    mutedColor: mutedColor,
    borderColor: borderColor,
    tableHeaderFill: tableHeaderFill,
  )
}

#let conf(title: none, doc) = {
  let dataFile = sys.inputs.at("data", default: "data.json")
  let orgData = json(dataFile)
  let org = if "_org" in orgData and orgData._org != none { orgData._org } else { (:) }
  let orgName = if "name" in org and org.name != none and org.name != "" { org.name } else { "Company Name" }
  let t = getTheme(orgData)

  set text(font: t.fontFamily, size: t.baseFontSize, fill: t.primaryColor)

  set page(
    paper: "a4",
    margin: (top: 2cm, bottom: 2cm, left: 1.5cm, right: 1.5cm),
    header: [
      #set text(size: 9pt, weight: "bold", fill: rgb("#dc2626"))
      #grid(
        columns: (1fr, 1fr),
        [INTERNAL DOCUMENT - DO NOT DISTRIBUTE],
        align(right)[#text(size: 12pt, fill: t.primaryColor, title)]
      )
      #v(0.1cm)
      #line(length: 100%, stroke: 0.5pt + t.borderColor)
    ],
    footer: [
      #set text(8pt, fill: t.mutedColor)
      #line(length: 100%, stroke: 0.5pt + t.borderColor)
      #v(0.1cm)
      #grid(
        columns: (1fr, 1fr),
        orgName + " - Internal Use Only",
        align(right)[Page #context counter(page).display() of #context counter(page).final().at(0)]
      )
    ]
  )
  doc
}
