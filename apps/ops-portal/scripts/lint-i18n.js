const fs = require('fs');
const path = require('path');

// Flatten an object to dot notation keys
function flattenObject(ob) {
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
        pass;
      }
    }
  });
  return filelist;
}

const rootDir = path.resolve(__dirname, '..');
const enJsonPath = path.join(rootDir, 'messages', 'en.json');

if (!fs.existsSync(enJsonPath)) {
  console.error(`ERROR: ${enJsonPath} not found.`);
  process.exit(1);
}

const enJson = JSON.parse(fs.readFileSync(enJsonPath, 'utf8'));
const flatKeys = flattenObject(enJson);
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

// Regex to find useTranslations calls. 
// Matches: const t = useTranslations('namespace');
// Captures group 1: variable name (e.g. t, tCommon)
// Captures group 2: namespace (e.g. admin.settings)
const useTranslationsRegex = /(?:const|let|var)\s+(?:\{([^}]+)\}|\s*([a-zA-Z0-9_]+)\s*)\s*=\s*useTranslations\(\s*['"](.*?)['"]\s*\)/g;

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  
  // Find all namespaces mapped to variable names in this file
  const namespaces = {};
  
  let match;
  // Use a fresh regex to avoid lastIndex issues
  const localRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*useTranslations\(\s*['"](.*?)['"]\s*\)/g;
  while ((match = localRegex.exec(content)) !== null) {
    const varName = match[1];
    const namespace = match[2];
    namespaces[varName] = namespace;
  }
  
  // Also check if there's a global useTranslations() without namespace
  const globalRegex = /(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*useTranslations\(\s*\)/g;
  while ((match = globalRegex.exec(content)) !== null) {
    namespaces[match[1]] = ''; // Empty namespace
  }

  if (Object.keys(namespaces).length === 0) return;

  const lines = content.split('\n');
  lines.forEach((line, lineIndex) => {
    // For each translation variable, find calls to it like t('key') or t("key")
    for (const [varName, namespace] of Object.entries(namespaces)) {
      // Regex to match variable('some.key') or variable("some.key") with word boundaries
      const callRegex = new RegExp(`\\b${varName}\\s*\\(\\s*['"]([^'"]+)['"]`, 'g');
      
      let callMatch;
      while ((callMatch = callRegex.exec(line)) !== null) {
        const key = callMatch[1];
        
        // Construct the full key
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

if (errorsFound) {
  console.error('\n\x1b[31m❌ i18n Linting Failed: Found missing translation keys. Please add them to messages/en.json\x1b[0m');
  process.exit(1);
} else {
  console.log('\x1b[32m✅ i18n Linting Passed: All translation keys are valid.\x1b[0m');
}
