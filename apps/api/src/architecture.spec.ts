import * as fs from 'fs';
import * as path from 'path';

describe('Structural Architecture Tests', () => {
  it('must explicitly map SQL aggregations to numbers to prevent string coercion bugs', () => {
    const srcPath = path.resolve(__dirname, './');
    const violations: string[] = [];

    function scanDir(dir: string) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        if (!fs.existsSync(fullPath)) continue;
        if (fs.statSync(fullPath).isDirectory()) {
          scanDir(fullPath);
        } else if (fullPath.endsWith('.ts') && !fullPath.includes('.spec.ts')) {
          const content = fs.readFileSync(fullPath, 'utf8');
          const lines = content.split('\n');

          lines.forEach((line, i) => {
            // Check for sql<number>...SUM or COALESCE(SUM...
            if (line.includes('sql<number>') && line.includes('SUM')) {
              // If it doesn't have mapWith(Number) and it doesn't cast to float8
              const fullStatement =
                line + (lines[i + 1] || '') + (lines[i + 2] || '');
              if (
                !/\.mapWith\(\s*Number\s*,?\s*\)/.test(fullStatement) &&
                !fullStatement.includes('::float8')
              ) {
                violations.push(
                  `File: ${fullPath.replace(srcPath, '')} Line: ${i + 1}`,
                );
              }
            }
          });
        }
      }
    }

    scanDir(srcPath);

    if (violations.length > 0) {
      throw new Error(
        'Found sql<number> usages with SUM that lack .mapWith(Number) or ::float8 cast.\n' +
          'PostgreSQL returns aggregations (like SUM) on numeric/bigint columns as strings. ' +
          'TypeScript will think it is a number because of sql<number>, but at runtime it will be a string, ' +
          'leading to insidious concatenation bugs or NaN values.\n\n' +
          'Violations:\n' +
          violations.join('\n'),
      );
    }
  });
});
