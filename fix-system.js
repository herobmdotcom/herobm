const fs = require('fs');

function replaceFile(path, replacements) {
    let content = fs.readFileSync(path, 'utf8');
    for (const [from, to] of replacements) {
        content = content.split(from).join(to);
    }
    fs.writeFileSync(path, content, 'utf8');
}

replaceFile('apps/ops-portal/app/admin/settings/system/page.tsx', [
    ['await api.systemControllerGetAppConfig()', 'await api.systemControllerGetAppConfig({} as any)']
]);

console.log("Fixed systemControllerGetAppConfig");
