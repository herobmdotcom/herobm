#import "@preview/codetastic:0.2.2": qrcode

#let data = json(sys.inputs.at("data"))

#set page(
  paper: "a6",
  margin: (top: 0.6cm, bottom: 0.6cm, left: 0.6cm, right: 0.6cm)
)

#set text(font: "DejaVu Sans", size: 8pt)

#let org = if "_org" in data { data._org } else { (:) }
#let orgName = org.at("name", default: "")
#let orgAddr = org.at("addressLine1", default: "")
#let orgCity = org.at("city", default: "")
#let orgState = org.at("state", default: "")
#let orgPost = org.at("postCode", default: "")
#let orgPhone = org.at("phone", default: "")

#let header = data.header
#let shipmentNumber = header.at("shipmentNumber", default: "")
#let orderNumber = header.at("orderNumber", default: "")
#let customerName = header.at("customerName", default: "")
#let customerOrderNumber = header.at("customerOrderNumber", default: "")
#let trackingNumber = header.at("trackingNumber", default: "")
#let dispatchDate = header.at("dispatchDate", default: "")
#let deliveryName = header.at("deliveryName", default: "")
#let deliveryCompanyName = header.at("deliveryCompanyName", default: "")
#let deliveryPhone = header.at("deliveryPhone", default: "")
#let deliveryAddressLine1 = header.at("deliveryAddressLine1", default: "")
#let deliveryAddressLine2 = header.at("deliveryAddressLine2", default: "")
#let deliveryCity = header.at("deliveryCity", default: "")
#let deliveryState = header.at("deliveryState", default: "")
#let deliveryPostalCode = header.at("deliveryPostalCode", default: "")
#let deliveryCountry = header.at("deliveryCountry", default: "")
#let shippingNotes = header.at("shippingNotes", default: "")
#let customerAddress = header.at("customerAddress", default: "")

#let totalQuantity = if "totalQuantity" in data { data.totalQuantity } else { 0 }
#let totalLines = if "totalLines" in data { data.totalLines } else { 0 }

#let recipientName = if deliveryCompanyName != "" and deliveryCompanyName != none {
  deliveryCompanyName
} else if deliveryName != "" and deliveryName != none {
  deliveryName
} else {
  customerName
}

#let barcodePayload = if trackingNumber != "" and trackingNumber != "—" and trackingNumber != none {
  trackingNumber
} else if shipmentNumber != "" {
  shipmentNumber
} else {
  orderNumber
}

// ── SENDER / ORIGIN HEADER ──────────────────────────────────────────────────
#rect(
  width: 100%,
  stroke: 0.5pt + luma(160),
  inset: (x: 6pt, y: 5pt),
  radius: 2pt,
  fill: luma(250),
)[
  #grid(
    columns: (1fr, auto),
    align: (left + top, right + top),
    [
      #text(6pt, weight: "bold", fill: luma(100))[FROM:] \
      #text(8pt, weight: "bold")[#if orgName != "" [#orgName] else [HeroBM Fulfillment]] \
      #if orgAddr != "" [#text(7pt)[#orgAddr] \ ]
      #if orgCity != "" or orgState != "" or orgPost != "" [
        #text(7pt)[#orgCity #orgState #orgPost] \
      ]
      #if orgPhone != "" [#text(6.5pt, fill: luma(80))[Ph: #orgPhone]]
    ],
    [
      #text(6pt, weight: "bold", fill: luma(100))[SHIPMENT \#] \
      #text(8.5pt, weight: "bold")[#shipmentNumber] \
      #v(0.1cm)
      #text(6.5pt, fill: luma(90))[Date: #dispatchDate]
    ]
  )
]

#v(0.15cm)

// ── RECIPIENT / SHIP TO BLOCK (PROMINENT) ────────────────────────────────────
#rect(
  width: 100%,
  stroke: 1.5pt + black,
  inset: (x: 8pt, y: 7pt),
  radius: 3pt,
  fill: white,
)[
  #text(6.5pt, weight: "bold", fill: luma(90))[DELIVER TO:] \
  #v(0.05cm)
  #text(12pt, weight: "bold")[#recipientName] \
  #if deliveryName != "" and deliveryName != none and deliveryName != recipientName [
    #text(8pt, weight: "semibold")[Attn: #deliveryName] \
  ]
  #v(0.08cm)
  #if deliveryAddressLine1 != "" and deliveryAddressLine1 != none [
    #text(10pt)[#deliveryAddressLine1] \
    #if deliveryAddressLine2 != "" and deliveryAddressLine2 != none [#text(9.5pt)[#deliveryAddressLine2] \ ]
    #v(0.05cm)
    #text(11pt, weight: "bold")[#deliveryCity #if deliveryState != "" [#deliveryState] #if deliveryPostalCode != "" [#deliveryPostalCode]] \
    #if deliveryCountry != "" and deliveryCountry != none [#text(9.5pt, weight: "semibold")[#deliveryCountry] \ ]
  ] else [
    #text(10pt)[#customerAddress] \
  ]
  #if deliveryPhone != "" and deliveryPhone != none [
    #v(0.05cm)
    #text(7.5pt, fill: luma(80))[Contact: #deliveryPhone]
  ]
]

#v(0.15cm)

// ── REFERENCE & TRACKING BARCODE / QR CODE ──────────────────────────────────
#rect(
  width: 100%,
  stroke: 0.5pt + luma(160),
  inset: (x: 6pt, y: 6pt),
  radius: 2pt,
)[
  #grid(
    columns: (1fr, auto),
    gutter: 8pt,
    align: (left + top, center + horizon),
    [
      #grid(
        columns: (auto, 1fr),
        row-gutter: 4pt,
        column-gutter: 6pt,
        text(6.5pt, weight: "bold", fill: luma(100))[Order \#:], text(8pt, weight: "bold")[#orderNumber],
        text(6.5pt, weight: "bold", fill: luma(100))[Customer PO:], text(7.5pt)[#if customerOrderNumber != "" and customerOrderNumber != none [#customerOrderNumber] else [—]],
        text(6.5pt, weight: "bold", fill: luma(100))[Units / Lines:], text(7.5pt)[#totalQuantity units (#totalLines lines)],
        text(6.5pt, weight: "bold", fill: luma(100))[Package:], text(7.5pt, weight: "bold")[1 OF 1],
      )

      #v(0.15cm)
      #text(6.5pt, weight: "bold", fill: luma(100))[TRACKING \#:] \
      #text(10pt, weight: "bold")[#if trackingNumber != "" and trackingNumber != none [#trackingNumber] else [—]]
    ],
    [
      #align(center)[
        #qrcode(barcodePayload, width: 2.2cm)
        #v(0.05cm)
        #text(5.5pt, fill: luma(90))[#barcodePayload]
      ]
    ]
  )
]

// ── SPECIAL INSTRUCTIONS / NOTES ─────────────────────────────────────────────
#if shippingNotes != "" and shippingNotes != none [
  #v(0.15cm)
  #rect(
    width: 100%,
    stroke: 0.5pt + rgb("#e2e8f0"),
    fill: rgb("#f8fafc"),
    inset: (x: 6pt, y: 5pt),
    radius: 2pt,
  )[
    #text(6pt, weight: "bold", fill: rgb("#0f172a"))[DELIVERY INSTRUCTIONS:] \
    #text(7pt)[#shippingNotes]
  ]
]

#if "customPdfText" in data and data.customPdfText != "" [
  #v(0.15cm)
  #rect(
    width: 100%,
    stroke: 0.5pt + luma(180),
    inset: (x: 6pt, y: 4pt),
    radius: 2pt,
  )[
    #text(6.5pt)[#data.customPdfText]
  ]
]
