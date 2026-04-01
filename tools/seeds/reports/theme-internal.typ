#let conf(title: none, doc) = {
  let dataFile = sys.inputs.at("data", default: "data.json")
  let orgData = json(dataFile)
  let org = orgData.at("_org", default: (:))
  
  set page(
    paper: "a4",
    margin: (top: 2cm, bottom: 2cm, left: 1.5cm, right: 1.5cm),
    header: [
      #set text(size: 9pt, weight: "bold", fill: red)
      #grid(
        columns: (1fr, 1fr),
        [INTERNAL DOCUMENT - DO NOT DISTRIBUTE],
        align(right)[#text(size: 12pt, fill: black, title)]
      )
      #v(0.1cm)
      #line(length: 100%, stroke: 0.5pt + luma(200))
    ],
    footer: [
      #set text(8pt, fill: luma(120))
      #line(length: 100%, stroke: 0.5pt + luma(200))
      #v(0.1cm)
      #grid(
        columns: (1fr, 1fr),
        org.at("name", default: "Company Name") + " - Internal Use Only",
        align(right)[Page #context counter(page).display()]
      )
    ]
  )
  doc
}
