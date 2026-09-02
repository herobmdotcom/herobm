import { spawn } from 'child_process';
import fs from 'fs';

const child = spawn('node', ['dist/index.js']);

let output = '';

child.stdout.on('data', d => {
  output += d.toString();
  // We expect a single line of JSON, so we split by newline
  const lines = output.split('\n');
  for (const line of lines) {
    if (line.trim().startsWith('{') && line.includes('"id":1')) {
      try {
        const parsed = JSON.parse(line.trim());
        fs.writeFileSync('mcp_tools_response.json', JSON.stringify(parsed, null, 2));
        console.log('Successfully captured response.');
        child.kill();
        process.exit(0);
      } catch (e) {
        // partial json, wait for next chunk
      }
    }
  }
});

child.stderr.on('data', d => {
  console.error('SERVER LOG:', d.toString().trim());
});

child.stdin.write(JSON.stringify({
  jsonrpc: "2.0",
  id: 1,
  method: "tools/list"
}) + '\n');

setTimeout(() => {
  console.error('Timeout reached.');
  child.kill();
  process.exit(1);
}, 10000);
