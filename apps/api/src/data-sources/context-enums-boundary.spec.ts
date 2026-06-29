/**
 * Context Enums Boundary — Structural Test
 *
 * Guards against hardcoded context strings in API data-source registry calls or pdf templates.
 *
 * All context values MUST use the centralized constants from `@herobm/shared`
 * (e.g. `DATA_SOURCE_CONTEXT.SALES_ORDER`).
 */
import * as fs from 'fs';
import * as path from 'path';

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  if (!fs.existsSync(dir)) return results;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.next'].includes(entry.name)) continue;
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

interface Violation {
  file: string;
  line: number;
  pattern: string;
  snippet: string;
}

const PROHIBITED_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  {
    // register('sales-order', ...)
    // register("sales-order", ...)
    regex: /\.register\s*\(\s*['"][a-z0-9_-]+['"]/i,
    description:
      'Hardcoded context string in dataSourcesRegistry.register() call',
  },
  {
    // runHook('hook-name', id, 'sales-order', ...)
    // we match `.runHook(` followed by two arguments and then a string literal.
    // simpler: just match .runHook(..., ..., 'sales-order'
    // regex explanation: \.runHook\s*\( [^,]+ , [^,]+ , \s*['"][a-z0-9_-]+['"]
    regex: /\.runHook\s*\(\s*[^,]+,\s*[^,]+,\s*['"][a-z0-9_-]+['"]/i,
    description:
      'Hardcoded context string in pdfTemplatesService.runHook() call',
  },
];

const ALLOWLIST: RegExp[] = [
  /context-enums-boundary\.spec\.ts$/,
  /\.spec\.ts$/,
  /\.e2e-spec\.ts$/,
  /\.test\.tsx?$/,
];

describe('Context Enums Boundary (structural)', () => {
  const roots = [
    path.resolve(__dirname, '..', '..', '..', '..', 'apps', 'api', 'src'),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'apps',
      'ops-portal',
      'app',
    ),
    path.resolve(
      __dirname,
      '..',
      '..',
      '..',
      '..',
      'apps',
      'ops-portal',
      'components',
    ),
  ];

  it('no component or service should use hardcoded context strings', () => {
    const allFiles: string[] = [];
    for (const root of roots) {
      allFiles.push(
        ...findFiles(root, /\.(service\.ts|controller\.ts|tsx|ts)$/),
      );
    }

    const targetFiles = allFiles.filter(
      (f) => !ALLOWLIST.some((pattern) => pattern.test(f)),
    );

    const violations: Violation[] = [];

    for (const file of targetFiles) {
      const src = fs.readFileSync(file, 'utf-8');

      if (!src.includes('.register') && !src.includes('.runHook')) {
        continue;
      }

      const lines = src.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (
          line.trimStart().startsWith('//') ||
          line.trimStart().startsWith('*')
        ) {
          continue;
        }

        for (const { regex, description } of PROHIBITED_PATTERNS) {
          if (regex.test(line)) {
            const relPath = path.relative(
              path.resolve(__dirname, '..', '..', '..', '..'),
              file,
            );
            violations.push({
              file: relPath,
              line: i + 1,
              pattern: description,
              snippet: line.trim(),
            });
          }
        }
      }
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line}\n` +
            `    Pattern: ${v.pattern}\n` +
            `    Code:    ${v.snippet}\n`,
        )
        .join('\n');
      throw new Error(
        `Found hardcoded context strings!\n\n${report}\nPlease use DATA_SOURCE_CONTEXT from @herobm/shared instead.`,
      );
    }
  });
});
