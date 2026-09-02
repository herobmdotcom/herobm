/**
 * GL Transaction Boundary — Structural Test
 *
 * This test guards against broken boundaries and disconnected GL postings.
 *
 * `postJournalEntry` must ALWAYS participate in the caller's transaction
 * by passing the ambient `tx` object as its third argument. This ensures
 * atomicity between business operations and ledger updates.
 *
 * Root cause documented in: ADV-080
 *
 * The test statically reads every `.service.ts` file under `apps/api/src/`,
 * finds all calls to `postJournalEntry(`, and asserts that:
 *
 *   1. ALL calls MUST pass `tx` (third argument).
 *   2. `gl.service.ts` is excluded, as it contains the fallback self-contained
 *      transaction for manual API controller journal entries.
 */
import * as fs from 'fs';
import * as path from 'path';

interface CallSite {
  file: string;
  line: number;
  passesTx: boolean;
  snippet: string;
}

/**
 * Recursively find all files matching a pattern under a directory.
 */
function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

/**
 * Check if the postJournalEntry call passes a third argument (the tx object).
 * We look at the call and count arguments by tracking parentheses/braces.
 */
function callPassesTx(src: string, callIndex: number): boolean {
  // Find the opening paren of postJournalEntry(
  const openParen = src.indexOf('(', callIndex);
  if (openParen === -1) return false;

  // Walk forward counting parens/braces to find argument boundaries
  let depth = 1;
  let argCount = 1;
  let i = openParen + 1;

  while (i < src.length && depth > 0) {
    const ch = src[i];
    if (ch === '(' || ch === '{' || ch === '[') depth++;
    if (ch === ')' || ch === '}' || ch === ']') depth--;
    if (ch === ',' && depth === 1) argCount++;
    i++;
  }

  // postJournalEntry(lines, meta) = 2 args
  // postJournalEntry(lines, meta, tx) = 3 args
  return argCount >= 3;
}

describe('GL Transaction Boundary (structural)', () => {
  const srcRoot = path.resolve(__dirname, '..');

  it('every postJournalEntry call in service files must pass tx', () => {
    // gl.service.ts is excluded — its internal `doInsert` callback is the
    // fallback path for manual journal entries from the controller, which
    // have no parent transaction. The self-contained tx is created inside
    // postJournalEntry itself.
    const SELF_CONTAINED_FILES = ['gl/gl.service.ts'];

    const serviceFiles = findFiles(srcRoot, /\.service\.ts$/).filter(
      (f) =>
        !f.includes('.spec.') &&
        !SELF_CONTAINED_FILES.some((sf) => f.replace(/\\/g, '/').endsWith(sf)),
    );

    const violations: CallSite[] = [];
    const allCalls: CallSite[] = [];

    for (const file of serviceFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const relPath = path.relative(srcRoot, file);

      const callPattern = /postJournalEntry\s*\(/g;
      let callMatch: RegExpExecArray | null;

      while ((callMatch = callPattern.exec(src)) !== null) {
        const callIdx = callMatch.index;
        const lineNum = src.substring(0, callIdx).split('\n').length;
        const lineContent = src.split('\n')[lineNum - 1]?.trim() || '';

        const hasTx = callPassesTx(src, callIdx);

        const site: CallSite = {
          file: relPath,
          line: lineNum,
          passesTx: hasTx,
          snippet: lineContent,
        };

        allCalls.push(site);

        if (!hasTx) {
          violations.push(site);
        }
      }
    }

    expect(allCalls.length).toBeGreaterThan(0);

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line} — postJournalEntry called without passing tx.\n    ${v.snippet}`,
        )
        .join('\n\n');

      throw new Error(
        `\nGL Transaction Boundary Violations Found:\n\n${report}\n\n` +
          `All postJournalEntry calls in services must pass the ambient tx object ` +
          `as the third argument to ensure atomicity with the parent business operation.\n` +
          `See: ADV-080 / docs/continuous_improvement/remediations/REM-2026-05-04-adv080.md`,
      );
    }
  });
});
