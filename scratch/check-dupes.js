const fs = require('fs');

const fileData = fs.readFileSync('apps/ops-portal/messages/en.json', 'utf8');

const lines = fileData.split('\n');

let currentPath = [];
let keysAtPath = new Map(); 
let hasDuplicates = false;

lines.forEach((line, index) => {
  const lineNum = index + 1;
  const trimmed = line.trim();
  
  // Handle pops first if the line starts with }
  if (trimmed.startsWith('}') || trimmed.startsWith('},')) {
    currentPath.pop();
  }

  // Look for "key": value OR "key": {
  const match = line.match(/^(\s*)"([^"]+)"\s*:/);
  
  if (match) {
    const key = match[2];
    const parentPath = currentPath.join('.');
    
    if (!keysAtPath.has(parentPath)) {
      keysAtPath.set(parentPath, new Set());
    }
    
    const siblings = keysAtPath.get(parentPath);
    if (siblings.has(key)) {
      console.error(`DUPLICATE FOUND at line ${lineNum}: Key "${key}" already exists under "${parentPath || 'root'}"`);
      hasDuplicates = true;
    } else {
      siblings.add(key);
    }

    // Push to path if it's an object start
    // We check if it ends with { (ignoring trailing whitespace)
    if (trimmed.endsWith('{')) {
      currentPath.push(key);
    }
  }
});

if (!hasDuplicates) {
  console.log("SUCCESS: No duplicate keys found at any level.");
  process.exit(0);
} else {
  process.exit(1);
}
