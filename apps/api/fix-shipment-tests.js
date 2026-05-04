const fs = require('fs');
let file = fs.readFileSync('src/orders/shipment.service.spec.ts', 'utf8');

// Replace mockDb references with direct drizzle DB updates
file = file.replace(/mockDb\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?limit: jest\s*\.fn\(\)\s*\.mockResolvedValue\(\[\]\),[\s\S]*?\}\);/g, '');
file = file.replace(/mockDb\.select = jest\.fn\(\)\.mockReturnValue\(\{[\s\S]*?limit: jest\s*\.fn\(\)\s*\.mockResolvedValue\(\[\{ shipmentNumber: `SHP-\$\{today\}-0005` \}\]\),[\s\S]*?\}\);/g, 'await db.insert(salesOrderShipments).values([{...MOCK_SHIPMENT, shipmentId: "10000000-0000-0000-0000-000000000009", shipmentNumber: `SHP-${today}-0005`}]);');

file = file.replace(/mockDb\.onTable\('sales_orders',\s*\[\s*\{\s*\.\.\.PICKING_ORDER,\s*stateCode:\s*'draft'\s*\}\s*,\s*\]\);/g, 'await db.update(salesOrders).set({ stateCode: "draft" }).where(eq(salesOrders.salesOrderId, "00000000-0000-0000-0000-000000000001"));');

file = file.replace(/mockDb\.onTable\('sales_order_shipments',\s*\[\s*\{\s*\.\.\.MOCK_SHIPMENT,\s*stateCode:\s*'([^']+)'\s*\}\s*,\s*\]\);/g, 'await db.update(salesOrderShipments).set({ stateCode: "$1" }).where(eq(salesOrderShipments.shipmentId, "e0000000-0000-0000-0000-000000000001"));');

file = file.replace(/mockDb\.onTable\('products', \[\s*\{[^\}]+\}\s*\]\);/g, '');
file = file.replace(/mockDb\.onTable\('inventory_bin_entries', \[\s*\{[^\}]+\}\s*\]\);/g, 'await db.insert(inventoryBinEntries).values([{ binEntryId: "b0000000-0000-0000-0000-000000000005", productId: "a0000000-0000-0000-0000-000000000001", quantity: "10", binId: "10000000-0000-0000-0000-000000000002", locationId: "10000000-0000-0000-0000-000000000001" }]);');

file = file.replace(/mockDb\.onTable\('sales_order_shipment_lines',\s*\[\s*\{\s*\.\.\.MOCK_SHIPMENT_LINE,\s*productNumber:\s*'PN-1'\s*\}\s*,\s*\]\);/g, '');
file = file.replace(/mockDb\.onTable\('sales_order_shipments',\s*\[\]\);/g, 'await db.delete(salesOrderShipments);');

file = file.replace(/'order-001'/g, "'00000000-0000-0000-0000-000000000001'");
file = file.replace(/'line-001'/g, "'00000000-0000-0000-0000-000000000002'");
file = file.replace(/'ship-001'/g, "'e0000000-0000-0000-0000-000000000001'");
file = file.replace(/'shipline-001'/g, "'f0000000-0000-0000-0000-000000000001'");

fs.writeFileSync('src/orders/shipment.service.spec.ts', file, 'utf8');
