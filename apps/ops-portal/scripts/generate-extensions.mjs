import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const extensionsDir = path.resolve(__dirname, '../../../extensions');
const generatedDir = path.resolve(__dirname, '../src/generated');

if (!fs.existsSync(generatedDir)) {
  fs.mkdirSync(generatedDir, { recursive: true });
}

let content = `// AUTO-GENERATED FILE - DO NOT EDIT\n\nimport React from 'react';\n\nexport interface ExtensionTab {\n  target: string;\n  id: string;\n  label: string;\n  component: React.ComponentType<any>;\n}\n\n`;
let imports = [];
let registryItems = [];

if (fs.existsSync(extensionsDir)) {
  const extensions = fs.readdirSync(extensionsDir);
  for (const ext of extensions) {
    const extDir = path.join(extensionsDir, ext);
    if (!fs.statSync(extDir).isDirectory()) continue;

    const uiPath = path.join(extDir, 'src/ui');
    if (!fs.existsSync(uiPath)) continue;

    const targets = fs.readdirSync(uiPath);
    for (const target of targets) {
      const targetPath = path.join(uiPath, target);
      if (!fs.statSync(targetPath).isDirectory()) continue;

      const files = fs.readdirSync(targetPath);
      for (const file of files) {
        if (!file.endsWith('.tsx') && !file.endsWith('.ts')) continue;
        const componentName = file.replace(/\.tsx?$/, '');
        if (componentName === 'index') continue;

        // E.g. @herobm/extension-ma/ui/projects/FeedbackTab
        const importPath = `@herobm/extension-${ext}/ui/${target}/${componentName}`;
        imports.push(`import ${componentName} from '${importPath}';`);
        
        // Assume default export or named export? 
        // We'll use default exports for simplicity, or we can use named.
        // Let's use default import: import FeedbackTab from '...'
        
        const fileContent = fs.readFileSync(path.join(targetPath, file), 'utf-8');
        const labelMatch = fileContent.match(/export const tabLabel = ['"](.+?)['"]/);
        const label = labelMatch ? labelMatch[1] : componentName.replace(/([A-Z])/g, ' $1').trim().replace(/ Tab$/, '');
        
        registryItems.push(`  {
    target: '${target}', // e.g. 'projects'
    id: '${ext}-${componentName.toLowerCase()}',
    label: '${label}',
    component: ${componentName}
  }`);
      }
    }
  }
}

content += imports.join('\n') + '\n\n';
content += `export const extensionTabs: ExtensionTab[] = [\n${registryItems.join(',\n')}\n];\n`;

fs.writeFileSync(path.join(generatedDir, 'extension-tabs.ts'), content);
console.log('Successfully generated UI extension tabs.');
