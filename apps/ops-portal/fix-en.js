const fs = require('fs');
let content = fs.readFileSync('messages/en.json', 'utf8');
content = content.replace(
`      "toastLinkAdded": "Bin configuration added",\r\n      "generateInvoice": "Generate Invoice",`,
`      "toastLinkAdded": "Bin configuration added",
      "toastLinkUpdated": "Bin configuration updated",
      "confirmRemoveLink": "Are you sure you want to unlink this bin?",
      "toastLinkRemoved": "Bin configuration removed"
    }
  },
  "salesOrders": {
    "title": "Sales Orders",
    "subtitle": "Manage customer orders and quotes",
    "generateQuoteTitle": "Generate Quote PDF",
    "demandedQty": "{qty} demanded",
    "allocated": "Allocated",
    "openDemandBadge": "Open Demand",
    "buttons": {
      "createOrder": "+ Create Order",
      "createQuote": "Create Quote",
      "createInvoice": "Create Invoice",
      "printInvoice": "Invoice PDF",
      "generateInvoice": "Generate Invoice",`
);
fs.writeFileSync('messages/en.json', content);
