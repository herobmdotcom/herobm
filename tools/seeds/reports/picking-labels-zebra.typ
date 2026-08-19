#import "@preview/codetastic:0.2.2": qrcode

#let data = json(sys.inputs.at("data"))

#set page(
  paper: "a6",
  flipped: true,
  margin: (top: 0.6cm, bottom: 0.6cm, left: 0.8cm, right: 0.8cm)
)

#set text(size: 9pt)

#let orderId = data.header.at("orderId", default: "")
#let orderNumber = data.header.at("orderNumber", default: "")
#let customerName = data.header.at("customerName", default: "")
#let customerOrderNumber = data.header.at("customerOrderNumber", default: "")
#let orderDate = data.header.at("orderDate", default: "")

#if data.pickingLines.len() == 0 [
  #align(center + horizon)[
    #text(14pt, weight: "bold")[No items to pick]
  ]
] else [
  #for (i, pickLine) in data.pickingLines.enumerate() [
    #let binNumber = pickLine.at("binNumber", default: "—")
    #let productCode = pickLine.at("productCode", default: "")
    #let description = pickLine.at("description", default: "")
    #let qty = str(pickLine.at("qtyToPick", default: 0))
    #let barcodePayload = pickLine.at("barcodePayload", default: "")

    // Header banner
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #text(12pt, weight: "bold")[Order: #orderNumber] \
        #text(8pt, fill: luma(80))[Customer: #customerName #if customerOrderNumber != "" [(PO: #customerOrderNumber)]]
      ],
      [
        #text(8pt, fill: luma(80))[Date: #orderDate] \
        #text(8pt, weight: "bold", fill: luma(100))[Item #(i + 1) of #(data.pickingLines.len())]
      ]
    )

    #v(0.2cm)
    #line(length: 100%, stroke: 0.5pt + luma(180))
    #v(0.2cm)

    // Main content: Details & Barcode
    #grid(
      columns: (1.2fr, 0.8fr),
      gutter: 12pt,
      align: (left + top, center + top),
      [
        #text(8pt, fill: luma(100), weight: "bold")[PRODUCT SKU] \
        #text(14pt, weight: "bold")[#productCode]
        
        #v(0.1cm)
        #text(9pt)[#description]

        #v(0.3cm)
        #grid(
          columns: (1fr, 1fr),
          gutter: 8pt,
          [
            #rect(
              width: 100%,
              inset: 6pt,
              radius: 3pt,
              stroke: 0.5pt + luma(150),
              fill: luma(245),
              [
                #text(7pt, weight: "bold", fill: luma(100))[BIN LOCATION] \
                #text(13pt, weight: "bold")[#binNumber]
              ]
            )
          ],
          [
            #rect(
              width: 100%,
              inset: 6pt,
              radius: 3pt,
              stroke: 1pt + black,
              fill: luma(235),
              [
                #text(7pt, weight: "bold", fill: luma(60))[PICK QUANTITY] \
                #text(15pt, weight: "bold")[QTY: #qty]
              ]
            )
          ]
        )
      ],
      [
        #align(center)[
          #qrcode(barcodePayload, width: 2.8cm)
          #v(0.1cm)
          #text(6pt, fill: luma(80))[#productCode | QTY: #qty]
        ]
      ]
    )

    #if i + 1 < data.pickingLines.len() [
      #pagebreak()
    ]
  ]
]
