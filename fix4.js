const fs = require('fs');

function replaceAll(path, searchParams, replaceWith) {
  let file = fs.readFileSync(path, 'utf-8');
  file = file.replace(searchParams, replaceWith);
  fs.writeFileSync(path, file);
}

// 1. inventory-math.utils.ts
let invMath = fs.readFileSync('apps/api/src/inventory/inventory-math.utils.ts', 'utf-8');
invMath = 'export const PICKABLE_BIN_TYPES = [\'storage\', \'pick\', \'bulk\'];\n\n' + invMath;
invMath = invMath.replace(/\['storage', 'pick', 'bulk'\]/g, 'PICKABLE_BIN_TYPES');
fs.writeFileSync('apps/api/src/inventory/inventory-math.utils.ts', invMath);

// 2. transfers.service.ts
let transfers = fs.readFileSync('apps/api/src/orders/transfers/transfers.service.ts', 'utf-8');
transfers = 'import { PICKABLE_BIN_TYPES } from \'../../inventory/inventory-math.utils\';\n' + transfers;
transfers = transfers.replace(/\['storage', 'pick', 'bulk'\]/g, 'PICKABLE_BIN_TYPES');
fs.writeFileSync('apps/api/src/orders/transfers/transfers.service.ts', transfers);

// 3. picking.service.ts
let picking = fs.readFileSync('apps/api/src/orders/picking.service.ts', 'utf-8');
picking = 'import { PICKABLE_BIN_TYPES } from \'../inventory/inventory-math.utils\';\n' + picking;
picking = picking.replace(/\('storage', 'pick', 'bulk'\)/g, '(${sql.raw(PICKABLE_BIN_TYPES.map(t => `\'${t}\'`).join(\', \'))})');
fs.writeFileSync('apps/api/src/orders/picking.service.ts', picking);

// 4. picking-slip.service.ts
let pickingSlip = fs.readFileSync('apps/api/src/reports/picking-slip.service.ts', 'utf-8');
pickingSlip = 'import { PICKABLE_BIN_TYPES } from \'../inventory/inventory-math.utils\';\n' + pickingSlip;
pickingSlip = pickingSlip.replace(/\['storage', 'pick', 'bulk'\]/g, 'PICKABLE_BIN_TYPES');
fs.writeFileSync('apps/api/src/reports/picking-slip.service.ts', pickingSlip);

console.log('Fixed ADV-084 errors');
