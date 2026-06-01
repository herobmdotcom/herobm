const fs = require('fs');

const rep = (file, from, to) => {
  if (!fs.existsSync(file)) return;
  let c = fs.readFileSync(file, 'utf8');
  c = c.replace(new RegExp(from, 'g'), to);
  fs.writeFileSync(file, c);
};

// products/[id]/page.tsx
rep('apps/ops-portal/app/products/[id]/page.tsx', '\\(bin: unknown\\)', '(bin: { locationId: string; binId: string; isDefault?: boolean; binName?: string; locationName?: string })');
rep('apps/ops-portal/app/products/[id]/page.tsx', 'events: unknown', 'events: import("@/components/shared/ActivityTimeline").TimelineEvent[]');

// ProductKitComponentsTab.tsx
rep('apps/ops-portal/app/products/[id]/ProductKitComponentsTab.tsx', 'params\\.data', '(params.data as ComponentData)');

// InvoicesSection.tsx
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'const dbTaxAmount = inv\\.taxAmount', 'const dbTaxAmount = (inv as { taxAmount?: string | number }).taxAmount');
rep('apps/ops-portal/app/purchase-orders/[id]/InvoicesSection.tsx', 'const invLine = inv\\.lines', 'const invLine = (inv as { lines?: { purchaseOrderLineId: string; invoiceLineId: string; productId: string; productNumber: string; description: string; quantityInvoiced: string; pricePerUnit: string }[] }).lines');

// ReceivingSection.tsx
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'parseFloat\\(priceWarning\\.payload\\.poPrice as string\\)', 'parseFloat(((priceWarning.payload || {}) as Record<string, string>).poPrice)');
rep('apps/ops-portal/app/purchase-orders/[id]/ReceivingSection.tsx', 'parseFloat\\(priceWarning\\.payload\\.invoicePrice as string\\)', 'parseFloat(((priceWarning.payload || {}) as Record<string, string>).invoicePrice)');

console.log('Fixed');
