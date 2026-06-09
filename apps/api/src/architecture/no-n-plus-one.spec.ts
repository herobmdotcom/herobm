import * as fs from 'fs';
import * as path from 'path';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.service.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Architecture - Database Queries', () => {
  it('should not contain N+1 queries in service files', () => {
    const srcDir = path.resolve(__dirname, '..');
    const serviceFiles = walk(srcDir);
    const violations: string[] = [];

    // Simple heuristic: Look for `.map(async` followed by `this.db.select` or `this.db.query` within 300 characters
    const nPlusOneRegex =
      /\.map\s*\(\s*async[\s\S]{1,300}this\.db\.(select|query)/g;

    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf8');

      const hasPromiseAll = content.includes('Promise.all');
      const hasMapAsync = content.match(/\.map\s*\(\s*async/);
      const hasDbQuery = content.includes('this.db.');

      if (hasPromiseAll && hasMapAsync && hasDbQuery) {
        const matches = content.match(nPlusOneRegex);
        if (matches) {
          violations.push(path.relative(srcDir, file));
        }
      }
    }

    expect(violations).toEqual([]);
  });
});
