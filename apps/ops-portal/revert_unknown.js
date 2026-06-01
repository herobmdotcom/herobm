const fs = require('fs');

const rep = (file, from, to) => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

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
  rep(f, '\\bunknown\\b', 'any');
});

console.log("Replaced unknown with any");
