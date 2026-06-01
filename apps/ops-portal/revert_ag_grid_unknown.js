const fs = require('fs');
const path = require('path');

const files = [
  'app/products/[id]/page.tsx',
  'app/products/[id]/ProductKitComponentsTab.tsx',
  'app/products/ProductsContent.tsx',
  'app/purchase-orders/[id]/AllocationsSection.tsx',
  'app/purchase-orders/[id]/InitiateReturnModal.tsx',
  'app/purchase-orders/[id]/InvoicesSection.tsx',
  'app/purchase-orders/[id]/ReceivingSection.tsx',
  'app/purchase-orders/returns/[id]/page.tsx',
  'app/purchase-orders/demands/DemandsContent.tsx',
  'app/purchase-orders/returns/page.tsx'
];

files.forEach(f => {
  const fullPath = path.join(__dirname, f);
  if (!fs.existsSync(fullPath)) return;
  
  let content = fs.readFileSync(fullPath, 'utf8');

  // Specific strict string replacements for the `unknown` cast mistakes from previous subagents
  content = content.replace(/\(p: unknown\)/g, '(p: any)');
  content = content.replace(/\(params: unknown\)/g, '(params: any)');
  content = content.replace(/\(row: unknown\)/g, '(row: any)');
  content = content.replace(/\(alloc: unknown\)/g, '(alloc: any)');
  content = content.replace(/\(bin: unknown\)/g, '(bin: any)');
  content = content.replace(/\(c: unknown\)/g, '(c: any)');
  content = content.replace(/\(a: unknown, b: unknown\)/g, '(a: any, b: any)');
  content = content.replace(/as unknown\)/g, 'as any)');
  content = content.replace(/as unknown\]/g, 'as any]');
  content = content.replace(/as unknown;/g, 'as any;');
  content = content.replace(/as unknown,/g, 'as any,');
  // Handle some specific inline cases:
  content = content.replace(/<any \/\* modbm-allow-explicit-any \*\/>/g, '<any>'); 
  
  fs.writeFileSync(fullPath, content);
});
console.log('Restored ag-grid any exceptions');
