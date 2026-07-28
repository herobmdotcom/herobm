/**
 * State Enums Boundary — Structural Test
 *
 * Guards against hardcoded state strings in API requests or URLs.
 *
 * All stateCode values MUST use the centralized enums from `@herobm/shared`
 * (e.g. `RETURN_STATE.CONFIRMED`, `SALES_ORDER_STATE.DRAFT`).
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
    // stateCode=draft, stateCode=confirmed (inside URL strings)
    regex: /stateCode=[a-z_]+/i,
    description: 'Hardcoded stateCode string in URL or query parameter',
  },
  {
    // stateCode: 'draft' as any, stateCode: "confirmed"
    regex: /stateCode:\s*['"][a-z_]+['"]/i,
    description: 'Hardcoded stateCode string literal in object',
  },
  {
    // state === 'draft' (Wait, might be too broad or maybe exactly what we want)
    // Actually just targeting stateCode= and stateCode: is a good start.
    // We'll stick to stateCode since that was the specific failure.
    regex: /stateCode\s*(?:===|==|!==|!=)\s*['"][a-z_]+['"]/i,
    description: 'Hardcoded stateCode string literal in comparison',
  },
];

const ALLOWLIST: RegExp[] = [
  /state-machines\.ts$/,
  /state-enums-boundary\.spec\.ts$/,
  /\.spec\.ts$/,
  /\.e2e-spec\.ts$/,
  /\.test\.tsx?$/,
];

describe('State Enums Boundary (structural)', () => {
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

  it('no UI component or service should use hardcoded state strings', () => {
    const allFiles: string[] = [];
    for (const root of roots) {
      allFiles.push(...findFiles(root, /\.(service\.ts|tsx|ts)$/));
    }

    const targetFiles = allFiles.filter(
      (f) => !ALLOWLIST.some((pattern) => pattern.test(f)),
    );

    const violations: Violation[] = [];

    for (const file of targetFiles) {
      const src = fs.readFileSync(file, 'utf-8');

      if (!src.includes('stateCode')) {
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
            `    Code:    ${v.snippet}`,
        )
        .join('\n\n');

      throw new Error(
        `\nState Enums Boundary Violations Found:\n\n${report}\n\n` +
          `State strings must use centralized enums from @herobm/shared (e.g. RETURN_STATE.CONFIRMED).\n` +
          `Do not use hardcoded strings for 'stateCode' inside URLs, object literals, or comparisons.`,
      );
    }
  });
});
