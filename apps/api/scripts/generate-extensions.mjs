import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionsDir = path.resolve(__dirname, '../../../extensions');
const generatedDir = path.resolve(__dirname, '../src/generated');

const configPath = path.resolve(__dirname, '../../../herobm.json');
let enabledExtensions = [];
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (Array.isArray(config.extensions)) {
    enabledExtensions = config.extensions;
  }
}

if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

const junctionPath = path.resolve(__dirname, '../src/extensions');
if (fs.existsSync(junctionPath)) {
  if (fs.lstatSync(junctionPath).isSymbolicLink() || (fs.statSync(junctionPath).isDirectory() && !fs.readdirSync(junctionPath).length)) {
    // It's a symlink or empty dir, we can try to remove it. But actually on Windows, lstatSync on a junction returns isSymbolicLink() false sometimes, so we should just rmSync it.
    try { fs.rmSync(junctionPath, { recursive: true, force: true }); } catch (e) {}
  }
}
if (!fs.existsSync(junctionPath)) {
  fs.mkdirSync(junctionPath, { recursive: true });
} else {
  // Clear existing symlinks inside it
  for (const item of fs.readdirSync(junctionPath)) {
    try { fs.rmSync(path.join(junctionPath, item), { recursive: true, force: true }); } catch (e) {}
  }
}

for (const ext of enabledExtensions) {
  try {
    fs.symlinkSync(path.resolve(extensionsDir, ext), path.join(junctionPath, ext), 'junction');
  } catch (e) {}
}

// 1. Generate extension-schemas.ts
let schemasContent = `// AUTO-GENERATED FILE - DO NOT EDIT\n`;
let schemaExports = [];

// 2. Generate extension-modules.ts
let modulesContent = `// AUTO-GENERATED FILE - DO NOT EDIT\n`;
let moduleExports = [];

if (fs.existsSync(extensionsDir)) {
  const extensions = fs.readdirSync(extensionsDir);
  for (const ext of extensions) {
    if (!enabledExtensions.includes(ext)) continue;

    const extDir = path.join(extensionsDir, ext);
    if (!fs.statSync(extDir).isDirectory()) continue;

    // Check for schema
    const schemaPath = path.join(extDir, 'src/db/schema.ts');
    if (fs.existsSync(schemaPath)) {
      const importName = `${ext.replace(/[^a-zA-Z0-9]/g, '')}Schema`;
      schemasContent += `import * as ${importName} from '../extensions/${ext}/src/db/schema';\n`;
      schemaExports.push(`...${importName}`);
    }

    // Check for api module
    const apiPath = path.join(extDir, 'src/api');
    if (fs.existsSync(apiPath)) {
      const files = fs.readdirSync(apiPath);
      const moduleFile = files.find(f => f.endsWith('.module.ts'));
      if (moduleFile) {
        const moduleName = moduleFile.replace('.ts', '');
        // Read the file to find the class name
        const content = fs.readFileSync(path.join(apiPath, moduleFile), 'utf-8');
        const match = content.match(/export class (\w+Module)/);
        if (match) {
          modulesContent += `import { ${match[1]} } from '../extensions/${ext}/src/api/${moduleName}';\n`;
          moduleExports.push(match[1]);
        }
      }
    }
  }
}

schemasContent += `\nexport const extensionSchemas = {\n  ${schemaExports.join(',\n  ')}\n};\n`;
modulesContent += `\nexport const extensionModules = [\n  ${moduleExports.join(',\n  ')}\n];\n`;

fs.writeFileSync(path.join(generatedDir, 'extension-schemas.ts'), schemasContent);
fs.writeFileSync(path.join(generatedDir, 'extension-modules.ts'), modulesContent);

console.log('Successfully generated API extension files.');
