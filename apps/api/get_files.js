const fs = require('fs');
const lines = fs.readFileSync('eslint_utf8.txt', 'utf8').split('\n');
let currentFile = '';
const matches = [];
for (const line of lines) {
  const fileMatch = line.match(/^([A-Za-z]:\\[^ ]+\.ts)/);
  if (fileMatch) {
    currentFile = fileMatch[1];
  } else if (line.includes('ADV-050')) {
    const lineNumMatch = line.match(/^\s*(\d+):/);
    if (lineNumMatch) {
      matches.push(`${currentFile}:${lineNumMatch[1]}`);
    }
  }
}
console.log(matches.join('\n'));
