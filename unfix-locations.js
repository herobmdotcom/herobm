const fs = require('fs');
const path = require('path');

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walkDir(dirPath, callback) : callback(path.join(dir, f));
  });
}

let count = 0;

walkDir('apps/ops-portal', (file) => {
  if (file.endsWith('.tsx') || file.endsWith('.ts')) {
    let content = fs.readFileSync(file, 'utf-8');
    let original = content;

    content = content.replace(/\(res\.data as any\)\?\.data \|\| \[\]/g, 'res.data || []');
    content = content.replace(/res\.data as any/g, 'res.data');
    content = content.replace(/const locs = Array\.isArray\(res\) \? res : \(res\.data \|\| \[\]\);/g, 'const locs = res.data || [];');

    // Remove the unused res variable in cases like:
    // const res = response.data;
    // const locs = res.data || [];
    // That's more complex, let's just let standard regex handle the main cases first.

    // Some specific cases I wrote manually in `picking/page.tsx` or similar:
    if (content.includes('const res = response.data')) {
      content = content.replace(/const res = response\.data(?: as any)?;\s*const locs = (?:Array\.isArray\(res\) \? res : \(res\.data \|\| \[\]\)|res\.data \|\| \[\]|res);/g, 'const locs = response.data || [];');
    }

    if (original !== content) {
      fs.writeFileSync(file, content);
      console.log(`Reverted: ${file}`);
      count++;
    }
  }
});

console.log(`Modified ${count} files.`);
