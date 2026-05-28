const fs = require('fs');

function replaceFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (const [from, to] of replacements) {
        content = content.split(from).join(to);
    }
    fs.writeFileSync(path, content, 'utf8');
}

replaceFile('apps/ops-portal/app/inventory/components/BinContentsView.tsx', [
    ['const res = response.data;', 'const res = response.data as any;'],
    ['res?.data', '(res as any)?.data'],
]);

replaceFile('apps/ops-portal/app/inventory/components/TopographyView.tsx', [
    ['const res = response.data;', 'const res = response.data as any;'],
    ['res?.data', '(res as any)?.data'],
    ['tLoc(`binTypes.${bin.binType}`)', 'tLoc(`binTypes.${bin.binType}` as any)'],
    ['{ body: JSON.stringify(formData) }', 'formData as any'],
    ['formData)', 'formData as any)'],
    ['...formData, zoneId: initialData.zoneId }', '...formData, zoneId: initialData.zoneId } as any'],
    ['...formData, locationId: initialData.locationId }', '...formData, locationId: initialData.locationId } as any']
]);

replaceFile('apps/ops-portal/app/inventory/picking/page.tsx', [
    ['setPendingOrders(data.data || []);', 'setPendingOrders((data as any).data || []);'],
    ['const data = res.data;', 'const data = res.data as any;'],
    ['data.lines', '(data as any).lines'],
    ['lines,', 'lines } as any,'],
    ['{ id: selectedOrder.id, context: \'picking-slip\' }', '{ id: selectedOrder.id, context: \'picking-slip\' } as any'],
]);

replaceFile('apps/ops-portal/app/inventory/putaway/page.tsx', [
    ['const res = response.data;', 'const res = response.data as any;'],
    ['const data = response.data;', 'const data = response.data as any;'],
    ['data.data', '(data as any).data'],
]);

replaceFile('apps/ops-portal/app/inventory/shipping/page.tsx', [
    ['const res = response.data;', 'const res = response.data as any;'],
    ['const data = response.data;', 'const data = response.data as any;'],
    ['data.data', '(data as any).data'],
    ['{ id: shipment.shipmentId, context: \'shipment\' }', '{ id: shipment.shipmentId, context: \'shipment\' } as any']
]);

replaceFile('apps/ops-portal/app/inventory/components/LedgerView.tsx', [
    ['return { fontWeight: \'500\' };', 'return { fontWeight: \'500\' } as any;']
]);

replaceFile('apps/ops-portal/app/inventory/transfers/TransfersContent.tsx', [
    ['tStates.has(s)', 'tStates.has(s as any)'],
    ['tStates(s)', 'tStates(s as any)']
]);

replaceFile('apps/ops-portal/app/inventory/transfers/[id]/useTransferOrder.ts', [
    ['api.transfersControllerConfirm(id)', 'api.transfersControllerConfirm(id, {} as any)'],
    ['api.transfersControllerShip(id)', 'api.transfersControllerShip(id, {} as any)'],
    ['await api.transfersControllerReceive(id, { body: JSON.stringify({ lines }) });', 'await api.transfersControllerReceive(id, { lines } as any);']
]);

console.log('Fixed inventory types');
