const fs = require('fs');

const rep = (file, from, to) => {
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

// InitiateReturnModal
rep('apps/ops-portal/app/purchase-orders/[id]/InitiateReturnModal.tsx', '\\(line: Record<string, unknown>\\)', '(line: import("./types").OrderLine)');

// InvoicesSection
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', '\\(il as unknown\\)\\.lineId', '(il as { lineId?: string }).lineId');
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', '\\(r as unknown\\)\\.line\\.goodsReceivedLineId', '(r as { line: { goodsReceivedLineId: string } }).line.goodsReceivedLineId');

// ReceivingSection
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', '\\(e: Record<string, unknown>\\)', '(e: import("./types").OrderEvent)');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', '\\(e => e\\.payload', '(e => (e.payload as Record<string, unknown>)');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', '\\(ol: Record<string, unknown>\\)', '(ol: import("./types").OrderLine)');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'e\\.payload\\?', '(e.payload as Record<string, unknown>)?');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'e\\.payload\\.', '(e.payload as Record<string, unknown>).');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'priceWarning\\.payload\\.', '(priceWarning.payload as Record<string, unknown>).');

// DemandsContent
rep('apps/ops-portal/app/purchase-orders/demands/DemandsContent.tsx', '\\(params: unknown\\)', '(params: { data?: { demandId?: string } })');

// Returns/[id]/page.tsx
rep('apps/ops-portal/app/purchase-orders/returns/[id]/page.tsx', 'useState<unknown>\\(null\\)', 'useState<import("@/app/purchase-orders/[id]/types").OrderReturn | null>(null)');
rep('apps/ops-portal/app/purchase-orders/returns/[id]/page.tsx', '\\(returnDetails as unknown\\)', '(returnDetails as import("@/app/purchase-orders/[id]/types").OrderReturn)');
rep('apps/ops-portal/app/purchase-orders/returns/[id]/page.tsx', '\\(line: Record<string, unknown>\\)', '(line: import("@/app/purchase-orders/[id]/types").ReturnLine)');
rep('apps/ops-portal/app/purchase-orders/returns/[id]/page.tsx', 'line\\.purchaseOrderLineId as string', 'line.purchaseOrderLineId');

// Returns/page.tsx
rep('apps/ops-portal/app/purchase-orders/returns/page.tsx', '\\(data as unknown\\[\\]\\)', '(data as { purchaseOrderId?: string }[])');
rep('apps/ops-portal/app/purchase-orders/returns/page.tsx', '\\(x: unknown\\)', '(x: { purchaseOrderId?: string })');

console.log('Fixed typings');
