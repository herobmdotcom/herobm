const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

walkDir('apps/api/src', function(filePath) {
  if (filePath.endsWith('.controller.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    if (content.includes("schema: { type: 'object' }")) {
      content = content.replace(/schema:\s*\{\s*type:\s*'object'\s*\}/g, "type: Object");
      fs.writeFileSync(filePath, content);
      console.log('Fixed', filePath);
    }
  }
});
