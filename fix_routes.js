const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    if (f === 'node_modules' || f === '.next' || f === '.git' || f === 'dist') return;
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

function processApp(appPath, rules) {
    if (!fs.existsSync(appPath)) return;
    walkDir(appPath, (filePath) => {
        if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
        let content = fs.readFileSync(filePath, 'utf8');
        let newContent = content;
        for (const [search, replace] of Object.entries(rules)) {
            newContent = newContent.split(search).join(replace);
        }
        if (content !== newContent) {
            fs.writeFileSync(filePath, newContent, 'utf8');
            console.log('Updated: ' + filePath);
        }
    });
}

const salesRules = {
    '/api/orders': '/api/sales-orders',
    '\'/orders': '\'/sales-orders',
    '\"\/orders': '\"\/sales-orders',
    '\/orders': '\/sales-orders',
    '\"/orders': '\"/sales-orders'
};

const purchaseRules = {
    '/api/orders': '/api/purchase-orders',
    '\'/orders': '\'/purchase-orders',
    '\"\/orders': '\"\/purchase-orders',
    '\/orders': '\/purchase-orders',
    '\"/orders': '\"/purchase-orders'
};

processApp('apps/sales-portal', salesRules);
processApp('apps/ops-portal', salesRules);
processApp('apps/supplier-portal', purchaseRules);
processApp('apps/api', salesRules);

