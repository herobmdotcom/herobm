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

const dirsToScan = [
  'apps/api/src',
  'apps/ops-portal/app',
  'apps/ops-portal/components',
  'packages/database/src',
  'packages/sdk/src'
];

const badExamples = [];
let totalBadCount = 0;

dirsToScan.forEach(dir => {
  walkDir(dir, filePath => {
    if (filePath.endsWith('.ts') || filePath.endsWith('.tsx')) {
      const isTestFile = filePath.includes('.spec.') || filePath.includes('.test.') || filePath.includes('__tests__');
      
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        if (line.match(/\bany\b/)) {
          // Acceptable patterns
          if (line.match(/catch\s*\(\w+\s*:\s*any\s*\)/)) return; // catch (e: any)
          if (line.match(/Record<[^,]+,\s*any>/)) return; // Record<string, any>
          if (line.match(/\[\w+\s*:\s*string\]\s*:\s*any/)) return; // [key: string]: any
          if (line.match(/Map<[^,]+,\s*any>/)) return; // Map<string, any>
          if (line.match(/Promise<any>/)) return; // Promise<any> (borderline, but common in interfaces)
          if (line.match(/Observable<any>/)) return; 
          if (line.match(/EventEmitter<any>/)) return;
          if (line.match(/Array<any>|any\[\]/)) return; // any[]
          
          // Test file specific acceptable patterns
          if (isTestFile) {
            if (line.match(/as\s+any/)) return; // Mocking bypass
            if (line.match(/:\s*any/)) return; // Mock variables
          }
          
          // Frontend specific: ignore the ones we are currently fixing in Phase 6
          if (filePath.includes('ops-portal')) {
             if (line.match(/as\s+any/)) return; // The swarm is deleting these right now
          }

          // If we got here, it's potentially an unacceptable use
          totalBadCount++;
          if (badExamples.length < 20) {
            badExamples.push({
              file: filePath,
              line: index + 1,
              content: line.trim()
            });
          }
        }
      });
    }
  });
});

console.log(`Found ${totalBadCount} potentially unacceptable 'any' usages.`);
console.log('Sample of examples:');
badExamples.forEach(ex => console.log(`- ${ex.file}:${ex.line} -> ${ex.content}`));
