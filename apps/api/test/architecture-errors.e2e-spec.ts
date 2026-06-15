import * as fs from 'fs';
import * as path from 'path';

describe('Architecture Structural Test: Error Handling (e2e)', () => {
  it("should strictly use 'unknown' instead of 'any' in catch blocks", () => {
    // Scan across all our source directories in the monorepo
    const targetDirs = [
      path.join(__dirname, '../../src'), // apps/api/src
      path.join(__dirname, '../../../ops-portal/app'), // apps/ops-portal/app
      path.join(__dirname, '../../../ops-portal/components'), // apps/ops-portal/components
      path.join(__dirname, '../../../ops-portal/lib'), // apps/ops-portal/lib
      path.join(__dirname, '../../../../packages/shared/src'), // packages/shared/src
    ];

    function walk(dir: string): string[] {
      let results: string[] = [];
      if (!fs.existsSync(dir)) return results;

      const list = fs.readdirSync(dir);
      for (const file of list) {
        const fullPath = path.join(dir, file);
        if (
          fullPath.includes('node_modules') ||
          fullPath.includes('.next') ||
          fullPath.includes('dist')
        ) {
          continue;
        }

        const stat = fs.statSync(fullPath);
        if (stat && stat.isDirectory()) {
          results = results.concat(walk(fullPath));
        } else if (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx')) {
          results.push(fullPath);
        }
      }
      return results;
    }

    const errors: string[] = [];

    for (const dir of targetDirs) {
      const tsFiles = walk(dir);

      for (const file of tsFiles) {
        // Skip SDK generated files if they happen to be scanned
        if (file.includes('packages/sdk/src/generated')) continue;

        const code = fs.readFileSync(file, 'utf8');
        const lines = code.split('\n');

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];

          // Match catch (e: any) or catch(err : any)
          if (/catch\s*\(\s*[a-zA-Z0-9_]+\s*:\s*any\s*\)/.test(line)) {
            errors.push(
              `\nFile: ${file}:${i + 1}\nReason: Uses 'catch (e: any)' instead of 'catch (e: unknown)'. This disables strict error checking.\nLine: ${line.trim()}`,
            );
          }
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(
        `\nTypeless Catch Block Anti-Pattern detected:\n\n${errors.join('\n')}\n\n` +
          `To fix this, change the error signature to 'catch (e: unknown)' and use the getErrorMessage(e) utility from @herobm/shared.\n`,
      );
    }
  });
});
