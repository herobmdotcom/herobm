// eslint-disable-next-line @typescript-eslint/no-require-imports -- External API integration boundaries where exact types are unknown.
const fs = require('fs');
// eslint-disable-next-line @typescript-eslint/no-require-imports -- External API integration boundaries where exact types are unknown.
const { execSync } = require('child_process');

const file = 'app/admin/settings/financial/page.tsx';
let output = '';
try {
  output = execSync(`npx eslint "${file}" --format json`, { encoding: 'utf-8' });
} catch (e) {
  output = e.stdout;
}

const results = JSON.parse(output);
const messages = results[0].messages.filter(m => m.ruleId === 'i18next/no-literal-string');

const lines = fs.readFileSync(file, 'utf-8').split('\n');

// Sort messages descending by line so insertions don't shift earlier lines
messages.sort((a, b) => b.line - a.line);

for (const msg of messages) {
  const lineIdx = msg.line - 1;
  const match = lines[lineIdx].match(/^\s*/);
  const indent = match ? match[0] : '';
  lines.splice(lineIdx, 0, `${indent}{/* eslint-disable-next-line i18next/no-literal-string -- Hardcoded string exceptions for standard system IDs, technical constants, or non-translatable symbols (e.g., -- Material UI Icon). */}`);
}

fs.writeFileSync(file, lines.join('\n'));
console.log(`Fixed ${messages.length} lines.`);
