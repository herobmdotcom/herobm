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
  let lines = c.split('\n');
  lines = lines.filter(l => !l.includes('// @ts-expect-error'));
  fs.writeFileSync(f, lines.join('\n'));
});
