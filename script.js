const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

function replaceInFiles(dir, matchStr, replaceStr) {
  const files = execSync(git ls-files ).toString().split('\n').filter(Boolean);
  for (const file of files) {
    const filePath = path.join(process.cwd(), file);
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      let content = fs.readFileSync(filePath, 'utf8');
      if (content.includes(matchStr)) {
        content = content.replaceAll(matchStr, replaceStr);
        fs.writeFileSync(filePath, content, 'utf8');
      }
    }
  }
}

replaceInFiles('apps', '/api/orders', '/api/sales-orders');
