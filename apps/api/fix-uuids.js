const fs = require('fs');
const path = require('path');

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      if (file !== 'node_modules' && file !== 'dist') {
        processDir(fullPath);
      }
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.json')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let newContent = content
        .replace(/00000000-0000-0000-0000-/g, '00000000-0000-4000-8000-')
        .replace(/20000000-0000-0000-0000-/g, '20000000-0000-4000-8000-')
        .replace(/10000000-0000-0000-0000-/g, '10000000-0000-4000-8000-');
      
      if (content !== newContent) {
        console.log('Fixed:', fullPath);
        fs.writeFileSync(fullPath, newContent, 'utf8');
      }
    }
  }
}

processDir(path.join(__dirname, 'src'));
processDir(path.join(__dirname, 'test'));
