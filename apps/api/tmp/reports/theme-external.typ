#let conf(title: none, doc) = {
  let dataFile = sys.inputs.at("data", default: "data.json")
  let orgData = json(dataFile)
  let org = orgData.at("_org", default: (:))
  
  set page(
    paper: "a4",
    margin: (top: 3cm, bottom: 2.5cm, left: 2cm, right: 2cm),
    header-ascent: 15%,
    footer-descent: 15%,
    header: [
      #set text(size: 10pt)
      #grid(
        columns: (1fr, 1fr),
        [#text(size: 16pt, weight: "bold", org.at("name", default: "Company Name"))],
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
        org.at("website", default: ""),
        align(right)[Page #context counter(page).display()]
      )
    ]
  )
  doc
}
