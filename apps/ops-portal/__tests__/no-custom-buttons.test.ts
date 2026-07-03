/** @jest-environment node */
import * as fs from 'fs';
import * as path from 'path';

function findTsxFiles(dir: string, fileList: string[] = []): string[] {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const filePath = path.join(dir, file);
    if (fs.statSync(filePath).isDirectory()) {
      findTsxFiles(filePath, fileList);
    } else if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      fileList.push(filePath);
    }
  }
  return fileList;
}

describe('Structural Constraints', () => {
  it('should not contain any raw HTML <button> tags', () => {
    const appDir = path.join(__dirname, '../app');
    const files = findTsxFiles(appDir);
    
    const violations: { file: string; line: number; content: string }[] = [];
    
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      lines.forEach((line, index) => {
        // Look for raw button tags, ignoring commented lines or JSX comments
        // This is a naive regex but good enough for structural tracking
        if (line.match(/<\s*button\b/) && !line.match(/\/\//) && !line.match(/\{\s*\/\*/)) {
          violations.push({
            file: path.relative(appDir, file),
            line: index + 1,
            content: line.trim()
          });
        }
      });
    }

    if (violations.length > 0) {
      console.error(`Found ${violations.length} raw <button> tags across ${new Set(violations.map(v => v.file)).size} files!`);
      violations.forEach(v => {
        console.error(`  - ${v.file}:${v.line} -> ${v.content}`);
      });
    }

    expect(violations.length).toBe(0);
  });
});
