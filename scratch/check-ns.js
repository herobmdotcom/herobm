const fs = require('fs');
const path = require('path');

const enRaw = fs.readFileSync('./apps/ops-portal/messages/en.json', 'utf8');
let en;
try {
  en = JSON.parse(enRaw);
  console.log("en.json parsed successfully.");
} catch (e) {
  console.error("en.json is INVALID JSON!", e.message);
  process.exit(1);
}

function getNested(obj, p) {
  return p.split('.').reduce((acc, part) => acc && acc[part], obj);
}

const missing = [];
function traverseDir(dir) {
  fs.readdirSync(dir).forEach(file => {
    let fullPath = path.join(dir, file);
    if (fs.lstatSync(fullPath).isDirectory()) {
      traverseDir(fullPath);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      const regex = /useTranslations\(['"]([^'"]+)['"]\)/g;
      let match;
      while ((match = regex.exec(content)) !== null) {
        if (!getNested(en, match[1])) {
          missing.push(`Missing Namespace: ${match[1]} in ${fullPath}`);
        }
      }
    }
  });
}

traverseDir('./apps/ops-portal/app');
traverseDir('./apps/ops-portal/components');

if (missing.length > 0) {
  console.log("MISSING NAMESPACES FOUND:");
  console.log(missing.join('\n'));
} else {
  console.log("No missing namespaces detected statically.");
}
