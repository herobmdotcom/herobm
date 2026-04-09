const fs = require('fs');
const glob = require('glob');
glob.sync('apps/api/test/**/*.e2e-spec.ts').forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  let changed = false;
  if(c.includes("'/api/locations'")) {
    c = c.replace(/'\/api\/locations'/g, "'/api/inventory/locations'");
    changed = true;
  }
  
  if (f.includes('inventory-cycle') || f.includes('receptions') || f.includes('archive') || f.includes('purchase-invoices') || f.includes('freight-lifecycle')) {
     let name = c.includes('validLocationId =') ? 'validLocationId' : 'locationId';
     c = c.replace(/(\.post\('?\/api\/purchase-orders[^\n]*?\/receptions'?\)(?:.|\n)*?\.send\(\{)([\s\S]*?)(lines:|notes:)/g, '$1\n        locationId: ' + name + ',\n$2$3');
     
     // Also inventory-cycle has fulfillmentLocationId missing from sales-orders
     c = c.replace(/(\.post\('?\/api\/sales-orders'?\)[^]*?\.send\(\{)([\s\S]*?)(customerId:[^,]+)/g, '$1\n        fulfillmentLocationId: locationId,\n$2$3');
     
     changed = true;
  }
  
  if(changed) fs.writeFileSync(f, c);
});
console.log('Restored old fixes');
