const fs = require('fs');
['backorders', 'sales-invoices', 'picking', 'orders-write', 'returns'].forEach(f => {
  const p = 'apps/api/test/' + f + '.e2e-spec.ts';
  if(!fs.existsSync(p)) return;
  let c = fs.readFileSync(p, 'utf8');
  let name = c.includes('validLocationId =') ? 'validLocationId' : 'locationId';
  c = c.replace(/(\.post\('?\/api\/sales-orders'?\)(?:.|\n)*?\.send\(\{)([\s\S]*?)(\n\s*)(lines:|name:|customerId:|stateCode:)/g, '$1$3fulfillmentLocationId: ' + name + ',$3$4');
  fs.writeFileSync(p, c);
});
console.log('Final replacement done!');
