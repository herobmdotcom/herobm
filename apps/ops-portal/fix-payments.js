const fs = require("fs");
let content = fs.readFileSync("messages/en.json", "utf8");
content = content.replace(`    "type": "Type",\r\n    "purchInv": "Purch Inv",`, `    "type": "Type",
    "party": "Party",
    "mode": "Mode",
    "date": "Date",
    "status": "Status",
    "total": "Total",
    "unallocated": "Unallocated",
    "records": "Records",
    "loadingEllipsis": "Loading...",
    "noPayments": "No payments found",
    "receipt": "Receipt",
    "payment": "Payment",
    "view": "View",
    "allocate": "Allocate",
    "customer": "Customer",
    "supplier": "Supplier",
    "saving": "Saving...",
    "createEntry": "Create Entry",
    "salesInv": "Sales Inv",
    "partialAllocation": {
      "title": "Partial Allocation",
      "invoice": "Invoice",
      "outstanding": "Outstanding",
      "maxAvailable": "Max Available to Allocate",
      "amountToAllocate": "Amount to Allocate",
      "confirm": "Confirm Allocation"
    },
    "purchInv": "Purch Inv",`);
fs.writeFileSync("messages/en.json", content);

