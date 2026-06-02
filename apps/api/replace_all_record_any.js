const fs = require('fs');
const path = require('path');

function replaceInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      replaceInDir(fullPath);
    } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes('Record<string, any>')) {
        let lines = content.split('\n');
        let modified = false;
        for (let i = 0; i < lines.length; i++) {
          if (lines[i].includes('Record<string, any>')) {
            // Check if previous line has exemption
            if (i > 0 && lines[i - 1].includes('// modbm-allow-record-any')) {
              continue;
            }
            lines[i] = lines[i].replace(/Record<string, any>/g, 'Record<string, unknown>');
            modified = true;
          }
        }
        if (modified) {
          fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
          console.log('Modified: ' + fullPath);
        }
      }
    }
  }
}

replaceInDir('c:/Users/Marcel/volz/modbm/modbm/apps/api/src');
console.log('Done');
