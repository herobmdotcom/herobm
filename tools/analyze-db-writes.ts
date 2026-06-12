import * as fs from 'fs';
import * as path from 'path';

const apiSrcDir = 'c:/Users/Marcel/volz/modbm/modbm/apps/api/src';


function walk(dir: string, fileList: string[] = []) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const stat = fs.statSync(path.join(dir, file));
    if (stat.isDirectory()) {
      walk(path.join(dir, file), fileList);
    } else if (file.endsWith('.ts') && !file.endsWith('.spec.ts')) {
      fileList.push(path.join(dir, file));
    }
  }
  return fileList;
}

const files = walk(apiSrcDir);

const results: any[] = [];

for (const file of files) {
  const content = fs.readFileSync(file, 'utf-8');
  const lines = content.split('\n');
  
  let currentFunction = '';
  let dbWrites: { lineNo: number, type: string, table: string }[] = [];
  let events: { lineNo: number, eventStr: string }[] = [];
  let inFunction = false;

  // Very naive parsing: just look for functions/methods
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check for db writes
    const insertMatch = line.match(/\.insert\((.*?)\)/);
    const updateMatch = line.match(/\.update\((.*?)\)/);
    const deleteMatch = line.match(/\.delete\((.*?)\)/);
    
    if (insertMatch) dbWrites.push({ lineNo: i + 1, type: 'insert', table: insertMatch[1] });
    if (updateMatch) dbWrites.push({ lineNo: i + 1, type: 'update', table: updateMatch[1] });
    if (deleteMatch) dbWrites.push({ lineNo: i + 1, type: 'delete', table: deleteMatch[1] });
    
    // Check for event emit
    const emitMatch = line.match(/emitEvent\(/);
    if (emitMatch) {
      // try to extract event details from the next few lines
      let eventStr = '';
      for (let j = i; j < Math.min(i + 15, lines.length); j++) {
        eventStr += lines[j] + '\n';
        if (lines[j].includes('}')) break;
      }
      events.push({ lineNo: i + 1, eventStr });
    }
  }
  
  if (dbWrites.length > 0 || events.length > 0) {
    results.push({
      file: path.relative(apiSrcDir, file),
      dbWrites,
      events
    });
  }
}

fs.writeFileSync('c:/Users/Marcel/volz/modbm/modbm/db_writes_report.json', JSON.stringify(results, null, 2));
console.log('Report generated at db_writes_report.json');
