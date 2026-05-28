const fs = require('fs');

function replaceAll(path, searchParams, replaceWith) {
  let file = fs.readFileSync(path, 'utf-8');
  file = file.replace(searchParams, replaceWith);
  fs.writeFileSync(path, file);
}

// 1. Revert goods-received.e2e-spec.ts
replaceAll('apps/api/test/goods-received.e2e-spec.ts', /res\.body\.find/g, 'res.body.data.find');
replaceAll('apps/api/test/goods-received.e2e-spec.ts', /finalRes\.body\.find/g, 'finalRes.body.data.find');
replaceAll('apps/api/test/goods-received.e2e-spec.ts', /expect\(cancelRes\.status\)\.toBe\(200\);/g, 'expect(cancelRes.status).toBe(201);');

// 2. Revert archive.e2e-spec.ts
replaceAll('apps/api/test/archive.e2e-spec.ts', /\.expect\(200\);/g, '.expect(201);');
// But the GET /api/purchase-orders?limit=100000 still needs 200
let arc = fs.readFileSync('apps/api/test/archive.e2e-spec.ts', 'utf-8');
arc = arc.replace(/\/api\/purchase-orders\?limit=100000`\)\s*\n\s*\.set[^\n]*\n\s*\.expect\(201\);/g, '/api/purchase-orders?limit=100000`)\n        .set(\'Authorization\', `Bearer ${adminToken}`)\n        .expect(200);');
// Also the GET calls need to be 200!
// Ah, the test checks GET /api/customers?limit=100000 etc. All GET calls were originally expect(200)!
// My fix2.js replaced `.expect(201)` with `.expect(200)`. Wait, it didn't replace `.expect(200)` with `201` because it only replaced 201 -> 200.
// But now I am blindly replacing ALL `.expect(200)` with `.expect(201)` in `archive.e2e-spec.ts`!
// That's WRONG! I should just `git checkout -- apps/api/test/archive.e2e-spec.ts`!
