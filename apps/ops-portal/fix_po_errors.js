const fs = require('fs');

// Fix page.tsx
const pageFile = 'apps/ops-portal/app/purchase-orders/[id]/page.tsx';
let pC = fs.readFileSync(pageFile, 'utf8');
pC = pC.replace(/isAmountCol\(col\.header\)/g, 'isAmountCol(col.header as string)');
pC = pC.replace(/\(il: import\('@\/lib\/purchase-order-utils'\)\.InvoiceLine\)/g, '(il: { purchaseOrderLineId?: string })');
fs.writeFileSync(pageFile, pC);

// Fix ReceivingSection.tsx
const recFile = 'apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx';
let rC = fs.readFileSync(recFile, 'utf8');
rC = rC.replace(/line\.purchaseOrderLineId \|\| line\.salesOrderLineId/g, 'line.purchaseOrderLineId');
fs.writeFileSync(recFile, rC);

console.log("Done");
