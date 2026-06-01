const fs = require('fs');

const files = [
    {
        path: 'apps/ops-portal/app/(portal)/admin/import/csv/page.tsx',
        replacements: [
            { from: "const data = res.data;", to: "const data = res.data as { jobId: string };" }
        ]
    },
    {
        path: 'apps/ops-portal/app/general-ledger/journal-entries/JournalEntrySlideOver.tsx',
        replacements: [
            { from: "const detail = res.data;", to: "const detail = res.data as typeof res.data & { lines?: JournalLine[] };" }
        ]
    },
    {
        path: 'apps/ops-portal/app/purchase-orders/demands/LinkToPOSlideOver.tsx',
        replacements: [
            { from: "const lines = res.data || [];", to: "const lines = (res.data as unknown as any[]) || [];" }
        ]
    },
    {
        path: 'apps/ops-portal/app/sales-orders/[id]/ShipmentsSection.tsx',
        replacements: [
            { from: "setShipments(((res.data)?.data || res.data || []) as unknown as Shipment[])", to: "setShipments((res.data || []) as unknown as Shipment[])" }
        ]
    },
    {
        path: 'apps/ops-portal/components/products/AddSupplierModal.tsx',
        replacements: [
            { from: "setSuppliers((res.data)?.data || res.data || []);", to: "setSuppliers((('data' in res.data ? (res.data as any).data : res.data) || []) as any[]);" }
        ]
    },
    {
        path: 'apps/ops-portal/components/shared/CustomerSelect.tsx',
        replacements: [
            { from: "const dataArray = (res.data)?.data || res.data || [];", to: "const dataArray = (('data' in res.data ? (res.data as any).data : res.data) || []) as any[];" }
        ]
    },
    {
        path: 'apps/ops-portal/components/shared/POLineSearchInput.tsx',
        replacements: [
            { from: "const lines = res.data;", to: "const lines = res.data as unknown as POLine[];" }
        ]
    },
    {
        path: 'apps/ops-portal/components/shared/POMatchingPanel.tsx',
        replacements: [
            { from: "const lines = res.data;", to: "const lines = res.data as unknown as PendingPOLine[];" }
        ]
    },
    {
        path: 'apps/ops-portal/components/shared/POSearchInput.tsx',
        replacements: [
            { from: "setResults(((res.data)?.data || res.data || []) );", to: "setResults((('data' in res.data ? (res.data as any).data : res.data) || []) as any[]);" }
        ]
    },
    {
        path: 'apps/ops-portal/components/shared/ProductSearchInput.tsx',
        replacements: [
            { from: "setResults(((res.data)?.data || res.data || []) );", to: "setResults((('data' in res.data ? (res.data as any).data : res.data) || []) as any[]);" }
        ]
    },
    {
        path: 'apps/ops-portal/components/shared/SupplierSelect.tsx',
        replacements: [
            { from: "setFilteredSuppliers(((res.data)?.data || res.data || []) );", to: "setFilteredSuppliers((('data' in res.data ? (res.data as any).data : res.data) || []) as any[]);" }
        ]
    }
];

files.forEach(f => {
    if (!fs.existsSync(f.path)) return;
    let content = fs.readFileSync(f.path, 'utf8');
    f.replacements.forEach(r => {
        content = content.replace(r.from, r.to);
    });
    fs.writeFileSync(f.path, content);
    console.log(`Updated ${f.path}`);
});
