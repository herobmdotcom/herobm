const fs = require('fs');

const rep = (file, from, to) => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

// InitiateReturnModal
rep('apps/ops-portal/app/purchase-orders/[id]/InitiateReturnModal.tsx', 'orderLines: unknown\\[\\]', 'orderLines: import("./types").OrderLine[]');

// InvoicesSection
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'receiptLines: unknown\\[\\] = \\[\\]', 'receiptLines: { line: { goodsReceivedLineId: string }, receiptNumber: string }[] = []');
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'const \\{ data: lines \\} = await api\\.goodsReceivedControllerFindAllLines\\(', 'const { data: lines } = await api.goodsReceivedControllerFindAllLines(');
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'lines\\.data', '(lines as { data?: unknown[] }).data');

// ReceivingSection
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'events: unknown\\[\\]', 'events: import("./types").OrderEvent[]');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'orderLines: unknown\\[\\]', 'orderLines: import("./types").OrderLine[]');

// DemandsContent
rep('apps/ops-portal/app/purchase-orders/demands/DemandsContent.tsx', '\\(params: \\{ data\\?: \\{ demandId\\?: string \\} \\}\\)', '(params: import("ag-grid-community").ValueFormatterParams<DemandRow, any>)');

// Returns/[id]/page.tsx
const retFile = 'apps/ops-portal/app/purchase-orders/returns/[id]/page.tsx';
rep(retFile, 'setReturnDetails\\(\\(data\\.data \\|\\| data\\) as unknown as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)', 'setReturnDetails((data.data || data) as unknown as import("@/app/purchase-orders/[id]/types").OrderReturn)');
rep(retFile, 'setReturnDetails\\(\\(data\\.data \\|\\| data\\)\\)', 'setReturnDetails((data.data || data) as unknown as import("@/app/purchase-orders/[id]/types").OrderReturn)');
rep(retFile, 'await api\\.purchaseDebitNotesControllerCreateDebitNote\\(payload\\)', 'await api.purchaseDebitNotesControllerCreateDebitNote(payload as unknown as import("@modbm/sdk").CreateDebitNoteDto)');
rep(retFile, '\\(returnDetails as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)\\.returnId', '(returnDetails?.returnId)');
rep(retFile, '\\(returnDetails as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)\\.stateCode', '(returnDetails?.stateCode)');
rep(retFile, '\\(returnDetails as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)\\.lines', '(returnDetails?.lines || [])');
rep(retFile, '\\(returnDetails as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)\\.returnNumber', '(returnDetails?.returnNumber)');
rep(retFile, '\\(returnDetails as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)\\.orderNumber', '((returnDetails as unknown as { orderNumber: string })?.orderNumber)');
rep(retFile, '\\(returnDetails as import\\("@/app/purchase-orders/\\[id\\]/types"\\)\\.OrderReturn\\)\\.vendorName', '((returnDetails as unknown as { vendorName: string })?.vendorName)');

console.log('Fixed more types');
