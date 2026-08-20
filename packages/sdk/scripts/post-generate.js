const fs = require('fs');
const path = require('path');

const endpointsDir = path.join(__dirname, '../src/endpoints');
if (fs.existsSync(endpointsDir)) {
  const dirs = fs.readdirSync(endpointsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort();

  const lines = dirs.map(dir => `export * from './${dir}/${dir}';`);
  fs.writeFileSync(path.join(endpointsDir, 'index.ts'), lines.join('\n') + '\n');
}
