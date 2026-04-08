const fs = require('fs');

const fileData = fs.readFileSync('apps/ops-portal/messages/en.json', 'utf8');

const lines = fileData.split('\n');

let currentPath = [];
let keysAtPath = new Map(); // e.g. "root" -> ["accounts", "suppliers"], "root.suppliers" -> ["title", "buttons"]
let indentLevels = [];

let hasDuplicates = false;

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const match = line.match(/^(\s*)"([^"]+)"\s*:/);
  
  if (line.includes('}')) {
    currentPath.pop();
    indentLevels.pop();
  }

  if (match) {
    const indent = match[1].length;
    const key = match[2];

    const parentPath = currentPath.join('.');
    
    if (!keysAtPath.has(parentPath)) {
      keysAtPath.set(parentPath, new Set());
    }
    
    const siblings = keysAtPath.get(parentPath);
    if (siblings.has(key)) {
      console.error(`DUPLICATE FOUND at line ${lineNum}: Key "${key}" already exists under "${parentPath}"`);
      hasDuplicates = true;
    } else {
      siblings.add(key);
    }

    if (line.includes('{')) {
      currentPath.push(key);
      indentLevels.push(indent);
    }
  } else if (line.includes('{') && !line.match(/^(\s*)"([^"]+)"\s*:/)) {
    // root object or array item
    currentPath.push('root');
    indentLevels.push(line.match(/^\s*/)[0].length);
  }
});

if (!hasDuplicates) {
  console.log("SUCCESS: No duplicate keys found at any level.");
  process.exit(0);
} else {
  process.exit(1);
}
