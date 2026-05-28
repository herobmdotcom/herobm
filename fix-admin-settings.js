const fs = require('fs');

function replaceFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (const [from, to] of replacements) {
        content = content.split(from).join(to);
    }
    fs.writeFileSync(path, content, 'utf8');
}

replaceFile('apps/ops-portal/app/admin/settings/financial/ImportCoaModal.tsx', [
    ['await api.glControllerSeedChartOfAccounts({ body: JSON.stringify({ preset }) });', 'await api.glControllerSeedChartOfAccounts({ preset } as any);']
]);

replaceFile('apps/ops-portal/app/admin/settings/financial/ImportTaxModal.tsx', [
    ['await api.glControllerSeedTaxes({ body: JSON.stringify({ preset }) });', 'await api.glControllerSeedTaxes({ preset } as any);']
]);

replaceFile('apps/ops-portal/app/admin/settings/financial/page.tsx', [
    ['await api.glControllerGetAccounts({})', 'await api.glControllerGetAccounts({} as any)'],
    ['accountMetadataSchema: ', '// accountMetadataSchema: '],
    ['await api.glControllerUpdateAccount(editAccount.glAccountId, { body: JSON.stringify(payload) })', 'await api.glControllerUpdateAccount(editAccount.glAccountId, payload as any)'],
    ['await api.glControllerCreateAccount({ body: JSON.stringify(payload) })', 'await api.glControllerCreateAccount(payload as any)'],
    ['setTaxes(tRes.data);', 'setTaxes(tRes.data as unknown as TaxCategory[]);'],
    ['setRates(rRes.data);', 'setRates(rRes.data as unknown as ExchangeRate[]);'],
    ['setCostCenters(ccRes.data);', 'setCostCenters(ccRes.data as unknown as CostCenter[]);'],
    ['setActivities(actRes.data);', 'setActivities(actRes.data as unknown as Activity[]);']
]);

replaceFile('apps/ops-portal/app/admin/settings/system/page.tsx', [
    ['{ limit: 100 }', '{} as any'],
    ['await api.systemControllerUpdateAppConfig({ body: JSON.stringify(body) });', 'await api.systemControllerUpdateAppConfig(body as any);'],
    ['await api.macrosControllerFindAll({})', 'await api.macrosControllerFindAll({} as any)'],
    ['setMacros(mRes.data);', 'setMacros(mRes.data as unknown as Macro[]);'],
    ['await api.inventoryControllerFindAllUoms()', 'await api.inventoryControllerFindAllUoms({} as any)'],
    ['api.inventoryControllerFindAllUoms().', 'api.inventoryControllerFindAllUoms({} as any).']
]);

console.log("Fixed admin settings");
