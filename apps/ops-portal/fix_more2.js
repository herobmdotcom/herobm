const fs = require('fs');

const rep = (file, from, to) => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

// products/[id]/page.tsx
rep('apps/ops-portal/app/products/[id]/page.tsx', '\\(bin: \\{ locationId: string; binId: string; isDefault\\?: boolean; binName\\?: string; locationName\\?: string \\}\\)', '(bin: { locationId: string; binId: string; isDefault?: boolean; binName?: string; locationName?: string; binNumber?: string; isPrimary?: boolean; minQty?: string; maxQty?: string; quantityOnHand?: string })');
rep('apps/ops-portal/app/products/[id]/page.tsx', 'setEvents\\(res\\.data as unknown\\)', 'setEvents((res.data || []) as import("@/components/shared/ActivityTimeline").TimelineEvent[])');
rep('apps/ops-portal/app/products/[id]/page.tsx', '// @ts-expect-error', '');

// ProductKitComponentsTab.tsx
rep('apps/ops-portal/app/products/[id]/ProductKitComponentsTab.tsx', '\\(params\\.data as ComponentData\\)', '(params.data as unknown as ComponentData)');

// InvoicesSection.tsx
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', '\\(il as \\{ lineId\\?: string \\}\\)\\.lineId', '(il as { lineId?: string, invoiceLineId?: string }).lineId');
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'key=\\{il\\.invoiceLineId \\|\\| \\(il as \\{ lineId\\?: string \\}\\)\\.lineId', 'key={(il as { invoiceLineId?: string }).invoiceLineId || (il as { lineId?: string }).lineId');

// ReceivingSection.tsx
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'parseFloat\\(\\(\\(priceWarning\\.payload \\|\\| \\{\\}\\) as Record<string, string>\\)\\.poPrice\\)', 'parseFloat(((priceWarning.payload || {}) as Record<string, string>).poPrice || "0")');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'parseFloat\\(\\(\\(priceWarning\\.payload \\|\\| \\{\\}\\) as Record<string, string>\\)\\.invoicePrice\\)', 'parseFloat(((priceWarning.payload || {}) as Record<string, string>).invoicePrice || "0")');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'parseFloat\\(\\(\\(priceWarning\\.payload \\|\\| \\{\\}\\) as Record<string, string>\\)\\.qtyReceived\\)', 'parseFloat(((priceWarning.payload || {}) as Record<string, string>).qtyReceived || "0")');

console.log('Fixed');
