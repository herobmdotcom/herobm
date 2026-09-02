import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Structural Test: Domain Boundaries (e2e)', () => {
  it('should not use BIN_TYPE or raw bin type strings outside of the inventory domain', () => {
    const targetDir = path.join(__dirname, '../../src');

    function walk(dir: string): string[] {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;

      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        if (
          fullPath.includes('node_modules') ||
          fullPath.includes('dist') ||
          fullPath.includes('drizzle') ||
          fullPath.includes('seeds') ||
          fullPath.includes('scripts') ||
          fullPath.includes('inventory') // The inventory domain is allowed
        ) {
          continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.ts')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const errors: string[] = [];
    const tsFiles = walk(targetDir);

    for (const file of tsFiles) {
      const code = fs.readFileSync(file, 'utf8');

      // Look for BIN_TYPE import from shared
      if (code.includes('BIN_TYPE') && code.includes('@herobm/shared')) {
        errors.push(
          `File: ${file}\nReason: Imports BIN_TYPE from @herobm/shared. Bin types should be evaluated using inventory domain utilities like isPickableBinCondition() instead.`,
        );
      }

      // Look for raw strings used as bin types, e.g., === 'pick', === 'storage'
      if (
        /===\s*'(pick|storage|bulk|staging|quarantine|in_transit)'/.test(
          code,
        ) ||
        /!==\s*'(pick|storage|bulk|staging|quarantine|in_transit)'/.test(code)
      ) {
        errors.push(
          `File: ${file}\nReason: Uses raw string comparisons for bin types. Bin types should be evaluated using inventory domain utilities.`,
        );
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nDomain Boundary Violation detected:\n\n${errors.join('\n\n')}\n\n` +
          `To fix this, do not evaluate or import bin types directly outside the inventory domain. Use utilities from inventory-math.utils.ts instead.\n`,
      );
    }
  });
});
