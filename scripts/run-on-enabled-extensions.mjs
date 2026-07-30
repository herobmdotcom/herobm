import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const scriptName = process.argv[2];
if (!scriptName) {
  console.error("Usage: node run-on-enabled-extensions.mjs <script-name>");
  process.exit(1);
}

const configPath = path.resolve(__dirname, '../herobm.json');
let enabledExtensions = [];
if (fs.existsSync(configPath)) {
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  if (Array.isArray(config.extensions)) {
    enabledExtensions = config.extensions;
  }
}

const extensionsDir = path.resolve(__dirname, '../extensions');
if (fs.existsSync(extensionsDir)) {
  const extensions = fs.readdirSync(extensionsDir);
  for (const ext of extensions) {
    if (!enabledExtensions.includes(ext)) {
      continue;
    }
    
    const extPackagePath = path.join(extensionsDir, ext, 'package.json');
    if (fs.existsSync(extPackagePath)) {
      const extPackage = JSON.parse(fs.readFileSync(extPackagePath, 'utf8'));
      if (extPackage.scripts && extPackage.scripts[scriptName]) {
        console.log(`\n=== Running '${scriptName}' in extension: ${ext} ===`);
        try {
          execSync(`npm run ${scriptName} -w extensions/${ext}`, { stdio: 'inherit' });
        } catch (e) {
          console.error(`\x1b[31mFailed to run ${scriptName} in extension ${ext}\x1b[0m`);
          process.exit(1);
        }
      } else {
        console.log(`Skipping '${scriptName}' in extension ${ext} (no such script in package.json).`);
      }
    }
  }
}
