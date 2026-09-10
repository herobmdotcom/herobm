#import "@preview/codetastic:0.2.2": qrcode
#import "theme-internal.typ": getTheme

#let data = json(sys.inputs.at("data"))
#let theme = getTheme(data)

#set page(
  paper: "a6",
  flipped: true,
  margin: (top: 0.6cm, bottom: 0.6cm, left: 0.8cm, right: 0.8cm)
)

#set text(font: theme.fontFamily, size: 9pt, fill: theme.primaryColor)

#let orderId = data.header.at("orderId", default: "")
#let orderNumber = data.header.at("orderNumber", default: "")
#let customerName = data.header.at("customerName", default: "")
#let customerOrderNumber = data.header.at("customerOrderNumber", default: "")
#let orderDate = data.header.at("orderDate", default: "")
#let pickingLines = if "pickingLines" in data and data.pickingLines != none { data.pickingLines } else { () }

#if pickingLines.len() == 0 [
  #align(center + horizon)[
    #text(14pt, weight: "bold", fill: theme.primaryColor)[No items to pick]
  ]
] else [
  #for (i, pickLine) in pickingLines.enumerate() [
    #let binNumber = pickLine.at("binNumber", default: "—")
    #let productCode = pickLine.at("productCode", default: "")
    #let description = pickLine.at("description", default: "")
    #let qty = str(pickLine.at("qtyToPick", default: 0))
    #let rawBarcode = pickLine.at("barcodePayload", default: "")
    #let barcodePayload = if rawBarcode != "" and rawBarcode != none { rawBarcode } else if productCode != "" { productCode } else { orderNumber }

    // Header banner
    #grid(
      columns: (1fr, auto),
      align: (left, right),
      [
        #text(12pt, weight: "bold", fill: theme.primaryColor)[Order: #orderNumber] \
        #text(8pt, fill: theme.mutedColor)[Customer: #customerName #if customerOrderNumber != "" and customerOrderNumber != none [(PO: #customerOrderNumber)]]
      ],
      [
        #text(8pt, fill: theme.mutedColor)[Date: #orderDate] \
        #text(8pt, weight: "bold", fill: theme.accentColor)[Item #(i + 1) of #(pickingLines.len())]
      ]
    )

    #v(0.2cm)
    #line(length: 100%, stroke: 0.5pt + theme.borderColor)
    #v(0.2cm)

    // Main content: Details & Barcode
    #grid(
      columns: (1.2fr, 0.8fr),
      gutter: 12pt,
      align: (left + top, center + top),
      [
        #text(8pt, fill: theme.mutedColor, weight: "bold")[PRODUCT SKU] \
        #text(14pt, weight: "bold", fill: theme.primaryColor)[#productCode]
        
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
              stroke: 0.5pt + theme.borderColor,
              fill: theme.tableHeaderFill,
              [
                #text(7pt, weight: "bold", fill: theme.mutedColor)[BIN LOCATION] \
                #text(13pt, weight: "bold", fill: theme.primaryColor)[#binNumber]
              ]
            )
          ],
          [
            #rect(
              width: 100%,
              inset: 6pt,
              radius: 3pt,
              stroke: 1pt + theme.primaryColor,
              fill: theme.tableHeaderFill,
              [
                #text(7pt, weight: "bold", fill: theme.mutedColor)[PICK QUANTITY] \
                #text(15pt, weight: "bold", fill: theme.accentColor)[QTY: #qty]
              ]
            )
          ]
        )
      ],
      [
        #align(center)[
          #qrcode(barcodePayload, width: 2.8cm)
          #v(0.1cm)
          #text(6pt, fill: theme.mutedColor)[#productCode | QTY: #qty]
        ]
      ]
    )

    #if i + 1 < data.pickingLines.len() [
      #pagebreak()
    ]
  ]
]
