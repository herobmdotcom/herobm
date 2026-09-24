const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Flatten an object to dot notation keys
function flattenObject(ob, prefix = '') {
  var toReturn = {};
  for (var i in ob) {
    if (!ob.hasOwnProperty(i)) continue;

    if (typeof ob[i] == 'object' && ob[i] !== null) {
      var flatObject = flattenObject(ob[i]);
      for (var x in flatObject) {
        if (!flatObject.hasOwnProperty(x)) continue;
        toReturn[i + '.' + x] = flatObject[x];
      }
    } else {
      toReturn[i] = ob[i];
    }
  }
  return toReturn;
}

// Find all .ts and .tsx files
function walkSync(dir, filelist = []) {
  fs.readdirSync(dir).forEach(file => {
    const dirFile = path.join(dir, file);
    try {
      if (fs.statSync(dirFile).isDirectory()) {
        filelist = walkSync(dirFile, filelist);
      } else {
        if (dirFile.endsWith('.ts') || dirFile.endsWith('.tsx')) {
          filelist.push(dirFile);
        }
      }
    } catch (err) {
      if (err.code === 'OOM' || err.code === 'EISDIR') {
        // ignore
      }
    }
  });
  return filelist;
}

const rootDir = path.resolve(__dirname, '..');
const enDir = path.join(rootDir, 'messages', 'en');
const enJsonPath = path.join(rootDir, 'messages', 'en.json');

let fullEn = {};

if (fs.existsSync(enDir)) {
  const jsonFiles = fs.readdirSync(enDir).filter(f => f.endsWith('.json'));
  jsonFiles.forEach(f => {
    const ns = path.basename(f, '.json');
    const content = JSON.parse(fs.readFileSync(path.join(enDir, f), 'utf8'));
    fullEn[ns] = content;
  });
} else if (fs.existsSync(enJsonPath)) {
  fullEn = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
} else {
  console.error(`ERROR: Neither ${enDir} nor ${enJsonPath} found.`);
  process.exit(1);
}

function sortObjectKeys(obj) {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return obj;
  const sorted = {};
  Object.keys(obj).sort().forEach(key => {
    sorted[key] = sortObjectKeys(obj[key]);
  });
  return sorted;
}

// Keep messages/en.json synced and sorted for compatibility
fs.writeFileSync(enJsonPath, JSON.stringify(sortObjectKeys(fullEn), null, 2) + '\n');

const flatKeys = flattenObject(fullEn);
const allTranslationKeys = new Set(Object.keys(flatKeys));

const searchDirs = [
  path.join(rootDir, 'app'),
  path.join(rootDir, 'components'),
  path.join(rootDir, 'lib')
];

let files = [];
searchDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    files = files.concat(walkSync(dir));
  }
});

let errorsFound = false;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all namespaces mapped to variable names in this file
  const namespaces = {};
  
  let match;
  const localRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*useTranslations\(\s*['"](.*?)['"]\s*\)/g;
  while ((match = localRegex.exec(content)) !== null) {
    const varName = match[1];
    const namespace = match[2];
    namespaces[varName] = namespace;
  }
  
  const globalRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*useTranslations\(\s*\)/g;
  while ((match = globalRegex.exec(content)) !== null) {
    namespaces[match[1]] = ''; // Empty namespace
  }

  // Dynamic tDynamic calls
  const tDynamicRegex = /tDynamic\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*['"`](.*?)['"`]/g;
  while ((match = tDynamicRegex.exec(content)) !== null) {
    const varName = match[1];
    const key = match[2];
    if (key.includes('${')) continue; // Skip interpolated dynamic expressions
    const ns = namespaces[varName] !== undefined ? namespaces[varName] : '';
    const fullKey = ns ? `${ns}.${key}` : key;
    if (!allTranslationKeys.has(fullKey)) {
      console.error(`\x1b[31m[ERROR]\x1b[0m ${path.relative(rootDir, file)}`);
      console.error(`        Missing translation key (tDynamic): "\x1b[33m${fullKey}\x1b[0m"`);
      errorsFound = true;
    }
  }

  if (Object.keys(namespaces).length === 0) return;

  const lines = content.split('\n');
  lines.forEach((line, lineIndex) => {
    for (const [varName, namespace] of Object.entries(namespaces)) {
      const callRegex = new RegExp(`\\b${varName}\\s*\\(\\s*['"]([^'"]+)['"]`, 'g');
      
      let callMatch;
      while ((callMatch = callRegex.exec(line)) !== null) {
        const key = callMatch[1];
        const fullKey = namespace ? `${namespace}.${key}` : key;
        
        if (!allTranslationKeys.has(fullKey)) {
          console.error(`\x1b[31m[ERROR]\x1b[0m ${path.relative(rootDir, file)}:${lineIndex + 1}`);
          console.error(`        Missing translation key: "\x1b[33m${fullKey}\x1b[0m"`);
          errorsFound = true;
        }
      }
    }
  });
});

// Run ESLint on en.json and domain files to enforce duplicate key and alphabetical sorting checks
try {
  console.log('\nRunning ESLint on translation files to check for duplicates and sorting...');
  if (fs.existsSync(enDir)) {
    execSync('npx eslint "messages/en/*.json" --fix', { stdio: 'inherit', cwd: rootDir });
    execSync('npx eslint "messages/en/*.json" --max-warnings=0', { stdio: 'inherit', cwd: rootDir });
  }
  execSync('npx eslint messages/en.json --fix', { stdio: 'inherit', cwd: rootDir });
  execSync('npx eslint messages/en.json --max-warnings=0', { stdio: 'inherit', cwd: rootDir });
} catch (e) {
  console.error('\x1b[31m[ERROR] Translation files failed ESLint checks (duplicate keys or unsorted keys).\x1b[0m');
  errorsFound = true;
}

if (errorsFound) {
  console.error('\n\x1b[31m❌ i18n Linting Failed: Found missing translation keys. Please add them to messages/en/\x1b[0m');
  process.exit(1);
} else {
  console.log(`\x1b[32m✅ i18n Linting Passed: All ${allTranslationKeys.size} translation keys across ${Object.keys(fullEn).length} domain files are valid.\x1b[0m`);
}

