const fs = require('fs');
['backorders', 'sales-invoices'].forEach(f => {
  let p = 'apps/api/test/' + f + '.e2e-spec.ts';
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    if(!c.includes('let locationId: string;')) {
        c = c.replace(/let adminToken: string;/, 'let adminToken: string;\n  let locationId: string;');
        c = c.replace(/(adminToken\s*=\s*\S+;)/, "$1\n    const locRes = await request(app.getHttpServer()).get('/api/inventory/locations').set('Authorization', `Bearer ${adminToken}`).expect(200);\n    locationId = locRes.body.data[0].locationId;");
    }
    c = c.replace(/(\.post\('?\/api\/sales-orders'?\)[^]*?\.send\(\{)([\s\S]*?)(customerId:[^,]+)/g, '$1\n        fulfillmentLocationId: locationId,\n$2$3');
    fs.writeFileSync(p, c);
    console.log('Fixed ' + f);
  }
});
