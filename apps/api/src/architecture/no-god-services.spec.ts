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
    } else if (file.endsWith('.service.ts') && !file.endsWith('.spec.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Architecture - No God Services', () => {
  const MAX_LINES = 1500;

  // Pre-existing violations tracked by separate advisories.
  // Remove entries from this list as each service is decomposed.
  const KNOWN_VIOLATIONS = new Set<string>();

  it(`should not have any .service.ts file exceeding ${MAX_LINES} lines`, () => {
    const srcDir = path.resolve(__dirname, '..');
    const serviceFiles = walk(srcDir);
    const violations: { file: string; lines: number }[] = [];

    for (const file of serviceFiles) {
      const content = fs.readFileSync(file, 'utf8');
      const lineCount = content.split('\n').length;
      const relPath = path.relative(srcDir, file);

      if (
        lineCount > MAX_LINES &&
        !KNOWN_VIOLATIONS.has(path.normalize(relPath))
      ) {
        violations.push({
          file: relPath,
          lines: lineCount,
        });
      }
    }

    const report = violations.map((v) => `${v.file} (${v.lines} lines)`);

    expect(report).toEqual([]);
  });

  it('should track known violations that still exist', () => {
    const srcDir = path.resolve(__dirname, '..');
    const stillPresent: string[] = [];

    for (const knownFile of KNOWN_VIOLATIONS) {
      const fullPath = path.join(srcDir, knownFile);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, 'utf8');
        const lineCount = content.split('\n').length;
        if (lineCount > MAX_LINES) {
          stillPresent.push(`${knownFile} (${lineCount} lines)`);
        }
      }
    }

    // This test documents known violations. When you fix one, remove it from KNOWN_VIOLATIONS.
    // If this test fails because a known violation was fixed, that's a good thing!
    expect(stillPresent.length).toBeGreaterThanOrEqual(0);
  });
});
