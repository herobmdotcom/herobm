// Supplier Footer Fragment
// Renders the standard footer for supplier-facing documents
#let get(dict, key, default: none) = {
  if dict == none { return default }
  let val = dict.at(key, default: default)
  if val == none or val == "" { default } else { val }
}

#let getColor(theme, cfg, key, default: none) = {
  let val = get(theme, key)
  if val != none { return val }
  let hex = get(cfg, key)
  if hex != none { rgb(hex) } else { default }
}

#let footer(data, theme: none) = {
  let org = get(data, "_org", default: (:))
  let email = get(org, "email", default: "")
  let phone = get(org, "phone", default: "")
  let cfg = get(org, "pdfThemeConfig", default: (:))

  let primaryColor = getColor(theme, cfg, "primaryColor", default: rgb("#1e3a5f"))
  let mutedColor = getColor(theme, cfg, "mutedColor", default: primaryColor.lighten(30%))
  let borderColor = getColor(theme, cfg, "borderColor", default: primaryColor.lighten(75%))

  set text(8pt, fill: mutedColor)
  line(length: 100%, stroke: 0.5pt + borderColor)
  v(0.15cm)
  grid(
    columns: (1.5fr, 1fr),
    [
      For purchasing inquiries: #email #if phone != "" [| Tel: #phone]
    ],
    align(right)[
      Page #context counter(page).display() of #context counter(page).final().at(0)
    ]
  )
}
