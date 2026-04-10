const fs = require('fs');
let content = fs.readFileSync('./apps/ops-portal/app/suppliers/[id]/page.tsx', 'utf8');

if (!content.includes('const tSidebar = useTranslations')) {
  content = content.replace(/const tSales = useTranslations\('salesOrders'\);/, "const tSales = useTranslations('salesOrders');\n  const tToast = useTranslations('toast');\n  const tConfirm = useTranslations('confirm');\n  const tSidebar = useTranslations('sidebar');");
}

let rules = [
  [/tCommon\('confirm\.archiveOrder'\)/g, "tConfirm('archiveOrder')"],
  [/tCommon\('toast\.orderArchived'\)/g, "tToast('orderArchived')"],
  [/tCommon\('toast\.orderUnarchived'\)/g, "tToast('orderUnarchived')"],
  [/t\('common\.loading'\)/g, "tCommon('loading')"],
  [/t\('common\.noMatchingResults'\)/g, "tCommon('noMatchingResults')"],
  [/t\('sidebar\.items\.suppliers'\)/g, "tSidebar('items.suppliers')"],
  [/t\('common\.dismiss'\)/g, "tCommon('dismiss')"],
  [/t\('common\.columns\.name'\)/g, "tCommon('columns.name')"],
  [/t\('common\.columns\.currency'\)/g, "tCommon('columns.currency')"],
  [/t\('common\.selectEllipsis'\)/g, "tCommon('selectEllipsis')"],
  [/t\('common\.columns\.status'\)/g, "tCommon('columns.status')"],
  [/t\('common\.notesCardHeading'\)/g, "tCommon('notesCardHeading')"],
  [/t\('common\.notesCardPlaceholder'\)/g, "tCommon('notesCardPlaceholder')"],
  [/t\('common\.columns\.address'\)/g, "tCommon('columns.address')"]
];

rules.forEach(([search, replace]) => {
  content = content.replace(search, replace);
});

fs.writeFileSync('./apps/ops-portal/app/suppliers/[id]/page.tsx', content);
console.log('Fixed app/suppliers/[id]/page.tsx');
