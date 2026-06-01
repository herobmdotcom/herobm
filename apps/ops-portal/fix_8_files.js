const fs = require('fs');

const rep = (file, from, to) => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

// PurchaseOrdersContent.tsx
rep('apps/ops-portal/app/purchase-orders/PurchaseOrdersContent.tsx', '\\(p: unknown\\)', '(p: import("ag-grid-community").ICellRendererParams<any>)');
rep('apps/ops-portal/app/purchase-orders/PurchaseOrdersContent.tsx', '\\(params: unknown\\)', '(params: import("ag-grid-community").ValueFormatterParams<any>)');

// receiving/page.tsx
rep('apps/ops-portal/app/receiving/page.tsx', '\\(p: unknown\\)', '(p: import("ag-grid-community").ICellRendererParams<any>)');
rep('apps/ops-portal/app/receiving/page.tsx', '\\(row: unknown, defaultRender: unknown\\)', '(row: any, defaultRender: React.ReactNode)');
rep('apps/ops-portal/app/receiving/page.tsx', '\\(params: unknown\\)', '(params: import("ag-grid-community").ValueFormatterParams<any>)');
rep('apps/ops-portal/app/receiving/page.tsx', 'row: unknown', 'row: any');

// sales-invoices/page.tsx
rep('apps/ops-portal/app/sales-invoices/page.tsx', '\\(row: unknown, defaultRender: unknown\\)', '(row: any, defaultRender: React.ReactNode)');
rep('apps/ops-portal/app/sales-invoices/page.tsx', '\\(p: unknown\\)', '(p: import("ag-grid-community").ICellRendererParams<any>)');
rep('apps/ops-portal/app/sales-invoices/page.tsx', '\\(params: unknown\\)', '(params: import("ag-grid-community").ValueFormatterParams<any>)');
rep('apps/ops-portal/app/sales-invoices/page.tsx', 'row: unknown', 'row: any');
rep('apps/ops-portal/app/sales-invoices/page.tsx', 'DataTableColumn<unknown>', 'DataTableColumn<any>');
rep('apps/ops-portal/app/sales-invoices/page.tsx', 'ColDef<unknown>', 'ColDef<any>');

// ReceiveReturnSlideOver.tsx
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', '\\(line: unknown\\)', '(line: import("@modbm/sdk").OrderReturnLineDto)');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', '\\(l: unknown\\)', '(l: import("@modbm/sdk").OrderReturnLineDto & { quantityReceived: string })');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.lines\\.map', '(returnRecord.lines as import("@modbm/sdk").OrderReturnLineDto[]).map');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.lines\\.filter', '(returnRecord.lines as import("@modbm/sdk").OrderReturnLineDto[]).filter');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.salesOrderId', '(returnRecord.salesOrderId as string)');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.returnId', '(returnRecord.returnId as string)');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.locationId', '(returnRecord.locationId as string)');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.returnNumber', '(returnRecord.returnNumber as string)');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'returnRecord\\.orderNumber', '((returnRecord as unknown as { orderNumber: string }).orderNumber)');
rep('apps/ops-portal/app/receiving/returns/ReceiveReturnSlideOver.tsx', 'linesToReceive\\.length', '(linesToReceive as unknown[]).length');

// receiving/returns/page.tsx
rep('apps/ops-portal/app/receiving/returns/page.tsx', '\\(row: unknown, defaultRender: unknown\\)', '(row: any, defaultRender: React.ReactNode)');
rep('apps/ops-portal/app/receiving/returns/page.tsx', '\\(p: unknown\\)', '(p: import("ag-grid-community").ICellRendererParams<any>)');
rep('apps/ops-portal/app/receiving/returns/page.tsx', '\\(params: unknown\\)', '(params: import("ag-grid-community").ValueFormatterParams<any>)');
rep('apps/ops-portal/app/receiving/returns/page.tsx', 'row: unknown', 'row: any');
rep('apps/ops-portal/app/receiving/returns/page.tsx', 'DataTableColumn<unknown>', 'DataTableColumn<any>');
rep('apps/ops-portal/app/receiving/returns/page.tsx', 'ColDef<unknown>', 'ColDef<any>');

// ReturnsSection.tsx
rep('apps/ops-portal/app/purchase-orders/[id]/ReturnsSection.tsx', 'orderLines: unknown\\[\\]', 'orderLines: import("./types").OrderLine[]');
rep('apps/ops-portal/app/purchase-orders/[id]/ReturnsSection.tsx', 'events: unknown\\[\\]', 'events: import("./types").OrderEvent[]');
rep('apps/ops-portal/app/purchase-orders/[id]/ReturnsSection.tsx', 'rec: unknown', 'rec: { returnId: string }');
rep('apps/ops-portal/app/purchase-orders/[id]/ReturnsSection.tsx', '\\(listData as unknown\\)', '(listData as { data?: unknown[] })');

// usePurchaseOrder.ts
rep('apps/ops-portal/app/purchase-orders/[id]/usePurchaseOrder.ts', '\\(cat: unknown\\)', '(cat: import("./types").TaxCategory)');

// sales-orders/new/page.tsx
rep('apps/ops-portal/app/sales-orders/new/page.tsx', '\\(t as unknown\\)', '(t as Record<string, unknown>)');
rep('apps/ops-portal/app/sales-orders/new/page.tsx', '\\(o: unknown\\)', '(o: { uomCode: string; ratio?: string | number })');
rep('apps/ops-portal/app/sales-orders/new/page.tsx', '\\(t as Record<string, unknown>\\)\\.id', '(t as { id?: string }).id');

console.log("Fixed 8 files");
