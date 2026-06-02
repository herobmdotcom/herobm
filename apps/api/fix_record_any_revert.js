const fs = require('fs');

const files = [
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/auth/casbin.guard.spec.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/common/audit.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/common/encryption.service.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/common/interceptors/field-mask.interceptor.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/drizzle/modbm-core-schema.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/enrichment/enrichment.controller.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/enrichment/enrichment.dto.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/enrichment/enrichment.service.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/enrichment/providers/abr.provider.ts',
  'c:/Users/Marcel/volz/modbm/modbm/apps/api/src/enrichment/providers/enrichment-provider.interface.ts',
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('Record<string, unknown>')) {
    let lines = content.split('\n');
    let newLines = [];
    let modified = false;
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].includes('Record<string, unknown>')) {
        // Find leading whitespace
        let leadingSpace = lines[i].match(/^\s*/)[0];
        
        // Add the comment BEFORE this line if it's not already there
        if (i === 0 || !lines[i - 1].includes('// modbm-allow-record-any')) {
          newLines.push(leadingSpace + '// modbm-allow-record-any');
        }
        
        newLines.push(lines[i].replace(/Record<string, unknown>/g, 'Record<string, any>'));
        modified = true;
      } else {
        newLines.push(lines[i]);
      }
    }
    if (modified) {
      fs.writeFileSync(file, newLines.join('\n'), 'utf8');
      console.log('Modified: ' + file);
    }
  }
}
console.log('Done');
