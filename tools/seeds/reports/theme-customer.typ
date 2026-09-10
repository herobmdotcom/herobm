#import "fragment-customer-header.typ": header as customerHeader
#import "fragment-customer-footer.typ": footer as customerFooter

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
  let t = getTheme(orgData)

  set text(font: t.fontFamily, size: t.baseFontSize, fill: t.primaryColor)

  set page(
    paper: "a4",
    margin: (top: 3cm, bottom: 2.5cm, left: 2cm, right: 2cm),
    header-ascent: 15%,
    footer-descent: 15%,
    header: customerHeader(orgData, title: title, theme: t),
    footer: customerFooter(orgData, theme: t)
  )
  doc
}
