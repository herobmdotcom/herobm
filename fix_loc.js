const fs = require('fs');
const files = [
  'apps/api/test/backorders.e2e-spec.ts',
  'apps/api/test/sales-invoices.e2e-spec.ts',
  'apps/api/test/audit.e2e-spec.ts',
  'apps/api/test/reports.e2e-spec.ts',
  'apps/api/test/picking.e2e-spec.ts',
  'apps/api/test/returns.e2e-spec.ts',
  'apps/api/test/orders-write.e2e-spec.ts'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  if (!c.includes('/api/inventory/locations')) {
    const fetchLoc = 
      "    const locRes = await request(app.getHttpServer())\n" +
      "      .get('/api/inventory/locations')\n" +
      "      .set('Authorization', `Bearer ${adminToken}`)\n" +
      "      .expect(200);\n" +
      "    locationId = locRes.body.data[0].locationId;\n";
    
    c = c.replace(/beforeAll\(async \(\) => \{[\s\S]*?adminToken = .*?;/m, match => match + '\n' + fetchLoc);
    c = c.replace(/let adminToken: string;/m, 'let adminToken: string;\n  let locationId: string;');
    fs.writeFileSync(f, c);
  }
});
console.log('Done locations!');
