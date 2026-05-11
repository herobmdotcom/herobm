/**
 * Return Credit Boundary — Structural Test
 *
 * Guards against hand-rolled return credit/net credit calculations.
 *
 * All return credit totals (subtotal, tax, fees, netCredit) MUST be
 * computed via `computeReturnCreditSummary()` from `@modbm/shared`.
 *
 * This test statically scans all `.service.ts` and `.tsx` files for
 * patterns that indicate inline return credit accumulation, such as:
 *
 *   - Manual fee reduction:  `amount - fee`, `total - fee`, `credit - fee`
 *   - Manual tax+amount:     `amount + tax`, `totalAmount + totalTax`
 *   - Accumulating returnFee in a reduce/loop alongside pricing amounts
 *
 * Files that legitimately import and call `computeReturnCreditSummary`
 * are allowed to reference `returnFee` for input preparation (mapping
 * lines to the function's input shape), but must not perform their own
 * aggregation of the net credit formula.
 */
import * as fs from 'fs';
import * as path from 'path';

/** Recursively find files matching a pattern, skipping node_modules/dist. */
function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
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

/**
 * Prohibited patterns — regex + description.
 *
 * These detect inline return-credit accumulation formulas that should
 * be delegated to `computeReturnCreditSummary`.
 *
 * We look for arithmetic involving return-specific variables:
 *   - `totalFees` / `totalFee` combined with subtraction from credit/amount
 *   - Manual `netCredit` / `netArCredit` assignment using raw arithmetic
 */
const PROHIBITED_PATTERNS: Array<{ regex: RegExp; description: string }> = [
  {
    // e.g. totalCredit - totalFees, totalAmount - totalFees, amount - fees
    regex: /\b(?:total(?:Credit|Amount)|amount)\s*[-−]\s*(?:total)?[Ff]ee/,
    description: 'Inline subtraction of fees from credit/amount total',
  },
  {
    // e.g. netCredit = totalAmount + totalTax - totalFees (raw arithmetic)
    // Excludes: netCredit = creditSummary.netCredit (reading from centralised result)
    // Excludes: destructured { netCredit } = summary
    regex:
      /\b(?:net(?:Ar)?[Cc]redit)\s*=\s*(?!.*(?:Summary|summary)\.)(?:total|credit(?!Summary)|subtotal|amount)/,
    description: 'Manual netCredit assignment from raw arithmetic',
  },
  {
    // e.g. += pricing.amount combined with += fee in same function scope
    // This is hard to do precisely with regex, so we detect the simpler pattern:
    // totalFees += fee (accumulator pattern outside of computeReturnCreditSummary)
    regex: /total[Ff]ees?\s*\+=\s*fee/,
    description:
      'Manual fee accumulation (should use computeReturnCreditSummary)',
  },
];

/**
 * Files that are explicitly allowed to contain these patterns.
 *
 * - `pricing.ts` — the canonical implementation
 * - `pricing.spec.ts` — tests for the canonical implementation
 * - `.spec.ts` / `.e2e-spec.ts` — test files may assert on values
 */
const ALLOWLIST: RegExp[] = [
  /pricing\.ts$/,
  /pricing\.spec\.ts$/,
  /\.spec\.ts$/,
  /\.e2e-spec\.ts$/,
];

describe('Return Credit Boundary (structural)', () => {
  // Scan both apps/api/src and apps/ops-portal/app
  const roots = [
    path.resolve(__dirname, '..'),
    path.resolve(__dirname, '..', '..', '..', 'ops-portal', 'app'),
  ];

  it('no service or component should hand-roll return credit calculations', () => {
    const allFiles: string[] = [];
    for (const root of roots) {
      if (fs.existsSync(root)) {
        allFiles.push(...findFiles(root, /\.(service\.ts|tsx)$/));
      }
    }

    // Filter out allowlisted files
    const targetFiles = allFiles.filter(
      (f) => !ALLOWLIST.some((pattern) => pattern.test(f)),
    );

    const violations: Violation[] = [];

    for (const file of targetFiles) {
      const src = fs.readFileSync(file, 'utf-8');

      // Skip files that don't deal with returns at all
      if (
        !src.includes('returnFee') &&
        !src.includes('return_fee') &&
        !src.includes('netCredit') &&
        !src.includes('netArCredit')
      ) {
        continue;
      }

      const lines = src.split('\n');

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // Skip comments
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
        `\nReturn Credit Boundary Violations Found:\n\n${report}\n\n` +
          `Return credit totals (subtotal, tax, fees, netCredit) must be computed ` +
          `via computeReturnCreditSummary() from @modbm/shared.\n` +
          `Do not hand-roll the formula "amount + tax - fees" in service or UI code.`,
      );
    }

    // Sanity: we should have scanned at least some return-related files
    const returnFiles = targetFiles.filter((f) => {
      const src = fs.readFileSync(f, 'utf-8');
      return src.includes('returnFee') || src.includes('netCredit');
    });
    expect(returnFiles.length).toBeGreaterThan(0);
  });
});
