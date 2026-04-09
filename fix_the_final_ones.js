const fs = require('fs');

['picking', 'returns', 'orders-write', 'reports'].forEach(f => {
  let p = 'apps/api/test/' + f + '.e2e-spec.ts';
  if (fs.existsSync(p)) {
    let c = fs.readFileSync(p, 'utf8');
    
    // 1. Add locationId initialization if missing
    if(!c.includes('let locationId: string;')) {
        c = c.replace(/let adminToken: string;/, 'let adminToken: string;\n  let locationId: string;');
        c = c.replace(/(adminToken\s*=\s*\S+;)/, "$1\n    const locRes = await request(app.getHttpServer()).get('/api/inventory/locations').set('Authorization', `Bearer ${adminToken}`).expect(200);\n    locationId = locRes.body.data[0].locationId;");
    }
    
    // 2. Add fulfillmentLocationId to POST /api/sales-orders if missing
    let name = c.includes('validLocationId =') ? 'validLocationId' : 'locationId';
    if (!c.includes('fulfillmentLocationId: ' + name)) {
      c = c.replace(/(\.post\('?\/api\/sales-orders'?\)[^]*?\.send\(\{)([\s\S]*?)(\n\s*)(lines:|name:|customerId:|stateCode:)/g, '$1\n        fulfillmentLocationId: ' + name + ',$2$3$4');
    }
    
    fs.writeFileSync(p, c);
    console.log('Fixed ' + f);
  }
});
