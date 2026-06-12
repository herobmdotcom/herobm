import * as fs from 'fs';
import * as path from 'path';

const rawData = fs.readFileSync('c:/Users/Marcel/volz/modbm/modbm/db_writes_report.json', 'utf-8');
const results = JSON.parse(rawData);

let md = '# Database Writes and Events Audit\n\n';
md += '| File | Database Writes (Table: Action) | Events Issued |\n';
md += '|---|---|---|\n';

for (const result of results) {
  const file = result.file.replace(/\\/g, '/');
  
  if (result.dbWrites.length === 0) continue;

  const writesMap = new Map<string, Set<string>>();
  for (const w of result.dbWrites) {
    if (!writesMap.has(w.table)) {
      writesMap.set(w.table, new Set());
    }
    writesMap.get(w.table)!.add(w.type);
  }

  const writesStrs: string[] = [];
  for (const [table, types] of writesMap.entries()) {
    writesStrs.push(`\`${table}\` (${Array.from(types).join(', ')})`);
  }
  const writesCol = writesStrs.join('<br>');

  const eventsStrs: string[] = [];
  for (const e of result.events) {
    const matchType = e.eventStr.match(/entityType:\s*([^,\n]+)/);
    const matchEvent = e.eventStr.match(/eventType:\s*([^,\n]+)/);
    if (matchType || matchEvent) {
      let typeStr = matchType ? matchType[1].trim() : '?';
      let eventStr = matchEvent ? matchEvent[1].trim() : '?';
      eventsStrs.push(`\`${typeStr}\` - \`${eventStr}\``);
    } else {
      eventsStrs.push('`(Dynamic/Unknown)`');
    }
  }
  const eventsCol = eventsStrs.length > 0 ? eventsStrs.join('<br>') : '*(None)*';

  md += `| ${file} | ${writesCol} | ${eventsCol} |\n`;
}

fs.writeFileSync('c:/Users/Marcel/volz/modbm/modbm/db_writes_report.md', md);
console.log('Markdown report generated at db_writes_report.md');
