const fs = require('fs');
const rep = (file, from, to) => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

// ProductsContent
rep('apps/ops-portal/app/products/ProductsContent.tsx', '\\(p: unknown\\)', '(p: import("ag-grid-community").ICellRendererParams<Record<string, unknown>>)');
rep('apps/ops-portal/app/products/ProductsContent.tsx', '\\(row: unknown, defaultRender: unknown\\)', '(row: Record<string, unknown>, defaultRender: React.ReactNode)');
rep('apps/ops-portal/app/products/ProductsContent.tsx', '\\(params: unknown\\)', '(params: import("ag-grid-community").ValueFormatterParams<Record<string, unknown>>)');
rep('apps/ops-portal/app/products/ProductsContent.tsx', 'row: unknown', 'row: Record<string, unknown>');

// ProductKitComponentsTab
rep('apps/ops-portal/app/products/[id]/ProductKitComponentsTab.tsx', '\\(params: unknown\\)', '(params: import("ag-grid-community").ValueFormatterParams<Record<string, unknown>>)');
rep('apps/ops-portal/app/products/[id]/ProductKitComponentsTab.tsx', 'DataTableColumn<unknown>', 'DataTableColumn<Record<string, unknown>>');
rep('apps/ops-portal/app/products/[id]/ProductKitComponentsTab.tsx', 'ColDef<unknown>', 'ColDef<Record<string, unknown>>');

// AllocationsSection
rep('apps/ops-portal/app/purchase-orders/[id]/AllocationsSection.tsx', 'alloc: Record<string, unknown>', 'alloc: import("./types").Allocation');
rep('apps/ops-portal/app/purchase-orders/[id]/AllocationsSection.tsx', 'Record<string, unknown>\\[\\]', 'import("./types").Allocation[]');
rep('apps/ops-portal/app/purchase-orders/[id]/AllocationsSection.tsx', 'alloc\\.salesOrderId', '(alloc.salesOrderId as string)');

// InvoicesSection
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'lines\\.data', '(lines as { data?: unknown[] }).data');
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'inv\\.taxAmount', '(inv as { taxAmount?: string | number }).taxAmount');

// ReceivingSection
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', '\\(e\\.payload as Record<string, unknown>\\)\\?', '(e.payload as Record<string, unknown>)');

console.log('Done');
