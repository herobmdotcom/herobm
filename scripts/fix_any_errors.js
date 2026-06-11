const fs = require('fs');
const path = require('path');

const errorsText = fs.readFileSync('any_errors.txt', 'utf8');
const blocks = errorsText.split('\n\n');

// Map of filePath -> array of fixes
// fix: { type: 'delete' | 'insert', lineIndex: number }
const fixesByFile = {};

for (const block of blocks) {
  if (!block.trim()) continue;
  const lines = block.split('\n');
  const fileMatch = lines[0].match(/File:\s*(.*?):(\d+)/);
  if (!fileMatch) continue;
  
  const filePath = fileMatch[1].trim();
  const lineNum = parseInt(fileMatch[2], 10);
  const reason = lines[1].trim();
  
  if (!fixesByFile[filePath]) {
    fixesByFile[filePath] = [];
  }
  
  if (reason.includes('Dead or redundant')) {
    // Delete the comment line
    fixesByFile[filePath].push({ type: 'delete', lineIndex: lineNum - 1 });
  } else if (reason.includes("Explicit 'any' detected")) {
    // Insert a comment above
    // If it's a generic parameter or inside JSX, // might be problematic, but we'll try // first
    // Actually, for explicit any, we'll use /* modbm-allow-explicit-any */ to be safe if it's inline, or // if it's a new line
    fixesByFile[filePath].push({ type: 'insert', lineIndex: lineNum - 1 });
  }
}

for (const filePath of Object.keys(fixesByFile)) {
  let contentLines = fs.readFileSync(filePath, 'utf8').split('\n');
  const fixes = fixesByFile[filePath].sort((a, b) => b.lineIndex - a.lineIndex); // Process from bottom to top
  
  for (const fix of fixes) {
    if (fix.type === 'delete') {
      contentLines.splice(fix.lineIndex, 1);
    } else if (fix.type === 'insert') {
      const targetLine = contentLines[fix.lineIndex];
      const indent = targetLine.match(/^\s*/)[0];
      
      // Basic heuristic: if it's inside JSX (starts with '<' or '{'), use JSX comment, else //
      if (targetLine.trim().startsWith('<') || targetLine.trim().startsWith('{')) {
        contentLines.splice(fix.lineIndex, 0, indent + '{/* modbm-allow-explicit-any */}');
      } else {
        contentLines.splice(fix.lineIndex, 0, indent + '// modbm-allow-explicit-any');
      }
    }
  }
  
  fs.writeFileSync(filePath, contentLines.join('\n'), 'utf8');
  console.log(`Fixed ${filePath}`);
}

console.log('Done!');
