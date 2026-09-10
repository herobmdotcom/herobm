// Customer Header Fragment
// Renders the standard header for customer-facing documents
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

#let header(data, title: none, theme: none) = {
  let org = get(data, "_org", default: (:))
  let orgName = get(org, "name", default: "Company Name")
  let logoFile = get(org, "logoFile")
  let taxNumber = get(org, "taxNumber")
  let cfg = get(org, "pdfThemeConfig", default: (:))

  let primaryColor = getColor(theme, cfg, "primaryColor", default: rgb("#1e3a5f"))
  let accentColor = getColor(theme, cfg, "accentColor", default: rgb("#2563eb"))
  let mutedColor = getColor(theme, cfg, "mutedColor", default: primaryColor.lighten(30%))
  let borderColor = getColor(theme, cfg, "borderColor", default: primaryColor.lighten(75%))

  grid(
    columns: (1fr, auto),
    gutter: 12pt,
    align: (left + horizon, right + horizon),
    [
      #if logoFile != none [
        #grid(
          columns: (auto, 1fr),
          gutter: 10pt,
          align: horizon,
          image(logoFile, height: 32pt, fit: "contain"),
          [
            #text(size: 14pt, weight: "bold", fill: primaryColor, orgName)
            #if taxNumber != none [
              \ #text(size: 8pt, fill: mutedColor)[Tax No: #taxNumber]
            ]
          ]
        )
      ] else [
        #text(size: 14pt, weight: "bold", fill: primaryColor, orgName)
        #if taxNumber != none [
          \ #text(size: 8pt, fill: mutedColor)[Tax No: #taxNumber]
        ]
      ]
    ],
    align(right + horizon)[
      #if title != none [
        #text(size: 14pt, weight: "bold", fill: accentColor, title)
      ]
    ]
  )
  v(0.2cm)
  line(length: 100%, stroke: 0.5pt + borderColor)
}
