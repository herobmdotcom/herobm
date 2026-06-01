const fs = require('fs');
const files = [
  'apps/ops-portal/app/products/[id]/page.tsx',
  'apps/ops-portal/app/products/[id]/ProductKitComponentsTab.tsx',
  'apps/ops-portal/app/products/ProductsContent.tsx',
  'apps/ops-portal/app/purchase-orders/demands/DemandsContent.tsx',
  'apps/ops-portal/app/purchase-orders/returns/[id]/page.tsx',
  'apps/ops-portal/app/purchase-orders/returns/page.tsx',
  'apps/ops-portal/app/purchase-orders/[id]/AllocationsSection.tsx',
  'apps/ops-portal/app/purchase-orders/[id]/InitiateReturnModal.tsx',
  'apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx',
  'apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx'
];
files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/\/\/ modbm-allow-explicit-any/g, '');
  c = c.replace(/any \/\* modbm-allow-explicit-any \*\//g, 'unknown');
  c = c.replace(/\(line: any\)/g, '(line: Record<string, unknown>)');
  c = c.replace(/\(alloc: any\)/g, '(alloc: Record<string, unknown>)');
  c = c.replace(/\(rec: any\)/g, '(rec: Record<string, unknown>)');
  c = c.replace(/as any/g, 'as unknown');
  c = c.replace(/: any/g, ': unknown');
  fs.writeFileSync(f, c);
});
console.log("Replaced any with unknown");
