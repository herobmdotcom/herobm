const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

const counts = {
  'apps/api': 0,
  'apps/ops-portal': 0,
  'packages/database': 0,
  'packages/sdk': 0,
  'packages/config': 0
};

const dirsToScan = [
  'apps/api/src',
  'apps/ops-portal/app',
  'apps/ops-portal/components',
  'packages/database/src',
  'packages/sdk/src'
];

dirsToScan.forEach(dir => {
  walkDir(dir, filePath => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const content = fs.readFileSync(filePath, 'utf8');
      const matches = content.match(/\bany\b/g);
      if (matches) {
        if (filePath.startsWith('apps\\api')) counts['apps/api'] += matches.length;
        if (filePath.startsWith('apps\\ops-portal')) counts['apps/ops-portal'] += matches.length;
        if (filePath.startsWith('packages\\database')) counts['packages/database'] += matches.length;
        if (filePath.startsWith('packages\\sdk')) counts['packages/sdk'] += matches.length;
        if (filePath.startsWith('packages\\config')) counts['packages/config'] += matches.length;
      }
    }
  });
});

console.log(JSON.stringify(counts, null, 2));
