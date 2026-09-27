// Customer Footer Fragment
// Renders the standard footer for customer-facing documents
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
  let orgWebsite = get(org, "website", default: "")
  let bankName = get(org, "bankName")
  let iban = get(org, "bankIban")
  let accountNum = get(org, "bankAccountNumber")
  let cfg = get(org, "pdfThemeConfig", default: (:))

  let primaryColor = getColor(theme, cfg, "primaryColor", default: rgb("#1e3a5f"))
  let mutedColor = getColor(theme, cfg, "mutedColor", default: primaryColor.lighten(30%))
  let borderColor = getColor(theme, cfg, "borderColor", default: primaryColor.lighten(75%))

  let addrParts = ()
  if get(org, "addressLine1") != none { addrParts.push(get(org, "addressLine1")) }
  if get(org, "addressLine2") != none { addrParts.push(get(org, "addressLine2")) }
  if get(org, "city") != none { addrParts.push(get(org, "city")) }
  if get(org, "state") != none { addrParts.push(get(org, "state")) }
  if get(org, "postCode") != none { addrParts.push(get(org, "postCode")) }
  if get(org, "country") != none { addrParts.push(get(org, "country")) }
  let orgAddress = addrParts.join(", ")

  let contactParts = ()
  if email != "" { contactParts.push(email) }
  if phone != "" { contactParts.push("Tel: " + phone) }
  if orgWebsite != "" { contactParts.push(orgWebsite) }
  let contactLine = contactParts.join(" | ")

  let bankParts = ()
  if bankName != none { bankParts.push("Bank: " + bankName) }
  if iban != none { bankParts.push("IBAN: " + iban) }
  if accountNum != none and iban == none { bankParts.push("Acc: " + accountNum) }
  let bankLine = bankParts.join(" | ")

  let footerLines = ()
  if orgAddress != "" { footerLines.push(orgAddress) }
  if contactLine != "" { footerLines.push(contactLine) }
  if bankLine != "" { footerLines.push(bankLine) }

  set text(8pt, fill: mutedColor)
  line(length: 100%, stroke: 0.5pt + borderColor)
  v(0.15cm)
  grid(
    columns: (1.5fr, 1fr),
    align: (left + bottom, right + bottom),
    [
      #for (i, line) in footerLines.enumerate() [
        #if i > 0 [\ ]#line
      ]
    ],
    [
      Page #context counter(page).display() of #context counter(page).final().at(0)
    ]
  )
}
