const fs = require('fs');

const files = [
  'apps/ops-portal/app/purchase-orders/[id]/ReturnsSection.tsx',
  'apps/ops-portal/app/purchase-orders/[id]/usePurchaseOrder.ts',
  'apps/ops-portal/app/purchase-orders/PurchaseOrdersContent.tsx',
  'apps/ops-portal/app/receiving/returns/page.tsx',
  'apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx',
  'apps/ops-portal/app/receiving/page.tsx',
  'apps/ops-portal/app/sales-invoices/page.tsx',
  'apps/ops-portal/app/sales-orders/new/page.tsx'
];

files.forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    c = c.replace(/\\bany\\b/g, 'unknown'); // wait, \\b in regex literal is \b, so:
    c = c.replace(/\bany\b/g, 'unknown');
    // Also remove any remaining comments
    c = c.replace(/\/\/ modbm-allow-explicit-unknown/g, '');
    c = c.replace(/\/\* modbm-allow-explicit-unknown \*\//g, '');
    c = c.replace(/\/\/ modbm-allow-explicit-any/g, '');
    fs.writeFileSync(f, c);
  }
});
console.log("Replaced any in 8 files");
