const fs = require('fs');

function replaceFile(path, replaces) {
  if (!fs.existsSync(path)) return;
  let content = fs.readFileSync(path, 'utf8');
  for (let [from, to] of replaces) {
    content = content.replace(from, to);
  }
  fs.writeFileSync(path, content);
}

replaceFile('apps/ops-portal/app/purchase-orders/PurchaseOrdersContent.tsx', [
  [/as unknown\)/g, 'as any)'],
  [/tStates\.has\(s as any\) \? tStates\(s as any\)/g, 'tStates.has(s as Parameters<typeof tStates>[0]) ? tStates(s as Parameters<typeof tStates>[0])']
]);

replaceFile('apps/ops-portal/app/receiving/page.tsx', [
  [/}: unknown\)/g, '}: any)'],
  [/useState<unknown\[\]>/g, 'useState<any[]>'],
  [/<unknown\[\]>/g, '<any[]>'],
  [/const gridColumns: unknown\[\] = /g, 'const gridColumns: any[] = '],
  [/useState<unknown>/g, 'useState<any>']
]);

replaceFile('apps/ops-portal/app/receiving/returns/page.tsx', [
  [/const gridColumns: unknown\[\]/g, 'const gridColumns: any[]']
]);

replaceFile('apps/ops-portal/app/purchase-orders/[id]/usePurchaseOrder.ts', [
  [/useState<unknown \| null>/g, 'useState<any | null>'],
  [/<unknown \| null>/g, '<any | null>'],
  [/useState<unknown>/g, 'useState<any>']
]);

console.log("Applied final targeted any fixes");
