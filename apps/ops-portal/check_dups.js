const fs = require('fs');
const content = fs.readFileSync('messages/en.json', 'utf8');

// A very simple checker: look for keys in the same object scope
let scope = [];
let keysInScope = {};
let duplicates = [];
let lines = content.split('\n');

for (let i = 0; i < lines.length; i++) {
  const line = lines[i].trim();
  if (line.includes('{')) {
    // new scope
    const match = line.match(/"(.*)"\s*:\s*\{/);
    if (match) {
      const key = match[1];
      if (keysInScope[scope.join('.')] && keysInScope[scope.join('.')].has(key)) {
        duplicates.push(scope.join('.') + '.' + key);
      }
      if (!keysInScope[scope.join('.')]) keysInScope[scope.join('.')] = new Set();
      keysInScope[scope.join('.')].add(key);
      scope.push(key);
    } else if (line === '{') {
      scope.push('root');
    }
  }
  
  if (line.includes('}')) {
    scope.pop();
  }
  
  // match "key": "value"
  const matchObj = line.match(/"([^"]+)"\s*:\s*"/);
  if (matchObj && !line.includes('{')) {
    const key = matchObj[1];
    const currentScope = scope.join('.');
    if (!keysInScope[currentScope]) keysInScope[currentScope] = new Set();
    
    if (keysInScope[currentScope].has(key)) {
      duplicates.push(currentScope + '.' + key);
    }
    keysInScope[currentScope].add(key);
  }
}

if (duplicates.length > 0) {
  console.log('Duplicates found:', duplicates);
  process.exit(1);
} else {
  console.log('No duplicates found.');
}
