import fs from 'fs';
import path from 'path';
import { RESOURCES, ACTIONS } from '../constants';

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else if (fullPath.endsWith('.ts')) {
      arrayOfFiles.push(fullPath);
    }
  });

  return arrayOfFiles;
}

describe('Permissions Sync', () => {
  it('should have all backend @CasbinResource and @CasbinAction defined in frontend constants', () => {
    const rootDir = path.resolve(__dirname, '../../../../../../..');
    const apiSrc = path.join(rootDir, 'apps/api/src');

    // Ensure the path is correct
    if (!fs.existsSync(apiSrc)) {
      throw new Error(`API source directory not found at: ${apiSrc}`);
    }

    const files = getAllFiles(apiSrc);
    const backendResources = new Set<string>();
    const backendActions = new Set<string>();

    files.forEach(file => {
      const content = fs.readFileSync(file, 'utf-8');
      
      const resourceMatches = content.matchAll(/@CasbinResource\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of resourceMatches) {
        backendResources.add(match[1]);
      }

      const actionMatches = content.matchAll(/@CasbinAction\(\s*['"]([^'"]+)['"]\s*\)/g);
      for (const match of actionMatches) {
        backendActions.add(match[1]);
      }
    });

     
    const missingResources = Array.from(backendResources).filter(r => !RESOURCES.includes(r as any));
    const missingActions = Array.from(backendActions).filter(a => !ACTIONS.includes(a));

    expect(missingResources).toEqual([]);
    expect(missingActions).toEqual([]);
  });
});
