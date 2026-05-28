const fs = require('fs');

// 1. archive.e2e-spec.ts
let archive = fs.readFileSync('apps/api/test/archive.e2e-spec.ts', 'utf-8');
archive = archive.replace(/(\/(?:archive|unarchive)`\)\s*\n\s*\.set[\s\S]*?\n\s*\.expect\()201(\);)/g, '$1200$2');
fs.writeFileSync('apps/api/test/archive.e2e-spec.ts', archive);

// 2. goods-received.e2e-spec.ts
let gr = fs.readFileSync('apps/api/test/goods-received.e2e-spec.ts', 'utf-8');
gr = gr.replace(/expect\(cancelRes\.status\)\.toBe\(201\);/g, 'expect(cancelRes.status).toBe(200);');
gr = gr.replace(/res\.body\.data\.find/g, 'res.body.find');
gr = gr.replace(/finalRes\.body\.data\.find/g, 'finalRes.body.find');
fs.writeFileSync('apps/api/test/goods-received.e2e-spec.ts', gr);

// 3. inventory-cycle.e2e-spec.ts
let inv = fs.readFileSync('apps/api/test/inventory-cycle.e2e-spec.ts', 'utf-8');
inv = inv.replace(/inventoryRes\.body\.data\.find/g, 'inventoryRes.body.find');
inv = inv.replace(/invResAfter\.body\.data\.find/g, 'invResAfter.body.find');
fs.writeFileSync('apps/api/test/inventory-cycle.e2e-spec.ts', inv);

// 4. purchase-returns.e2e-spec.ts
let pr = fs.readFileSync('apps/api/test/purchase-returns.e2e-spec.ts', 'utf-8');
pr = pr.replace(/(\/returns\/\$\{returnId\}\/ship`,\s*\n\s*\)\s*\n\s*\.set[^\n]*\n\s*)\.expect\(200\);/g, '$1.send({})\n        .expect(200);');
fs.writeFileSync('apps/api/test/purchase-returns.e2e-spec.ts', pr);

console.log('Fixed');
