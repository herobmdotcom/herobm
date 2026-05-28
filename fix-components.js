const fs = require('fs');
const glob = require('glob');

const files = glob.sync('apps/ops-portal/components/**/*.tsx');

for (const file of files) {
  let content = fs.readFileSync(file, 'utf-8');
  let newContent = content;

  // common patterns
  newContent = newContent.replace(/\(data\.data as unknown\) as /g, 'data.data as ');
  newContent = newContent.replace(/data\.data \|\| data/g, 'data.data');
  newContent = newContent.replace(/Array\.isArray\(data\) \? data : data\.data \|\| \[\]/g, 'data.data');
  newContent = newContent.replace(/const data = res as any;/g, 'const data = res;');
  newContent = newContent.replace(/res as any/g, 'res');

  // specific
  newContent = newContent.replace(/api\.purchaseOrdersControllerFindPendingLines\(\{ vendorId \} as any\)/g, 'api.purchaseOrdersControllerFindPendingLines({ vendorId })');
  newContent = newContent.replace(/Array\.isArray\(data\) \? data : \(data as any\)\.data \|\| \[\]/g, 'data.data');

  if (content !== newContent) {
    fs.writeFileSync(file, newContent, 'utf-8');
    console.log('Fixed', file);
  }
}
