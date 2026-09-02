#let conf(title: none, doc) = {
  let dataFile = sys.inputs.at("data", default: "data.json")
  let orgData = json(dataFile)
  let org = if "_org" in orgData and orgData._org != none { orgData._org } else { (:) }
  let orgName = if "name" in org and org.name != none and org.name != "" { org.name } else { "Company Name" }
  let orgWebsite = if "website" in org and org.website != none { org.website } else { "" }

  set text(font: ("DejaVu Sans", "Liberation Sans", "Helvetica", "Arial"), size: 10pt)

  set page(
    paper: "a4",
    margin: (top: 3cm, bottom: 2.5cm, left: 2cm, right: 2cm),
    header-ascent: 15%,
    footer-descent: 15%,
    header: [
      #set text(size: 10pt)
      #grid(
        columns: (1fr, 1fr),
        [#text(size: 16pt, weight: "bold", orgName)],
        align(right)[#text(size: 14pt, title)]
      )
      #v(0.2cm)
      #line(length: 100%, stroke: 0.5pt + luma(200))
    ],
    footer: [
      #set text(8pt, fill: luma(120))
      #line(length: 100%, stroke: 0.5pt + luma(200))
      #v(0.2cm)
      #grid(
        columns: (1fr, 1fr),
        orgWebsite,
        align(right)[Page #context counter(page).display() of #context counter(page).final().at(0)]
      )
    ]
  )
  doc
}
