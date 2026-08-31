/**
 * Journal Entry Source Type Boundary — Structural Test
 *
 * This test guards against hardcoded journal entry source type strings across services.
 * All journal entry source types must reference the centralized `JOURNAL_ENTRY_SOURCE_TYPE`
 * constant object exported from `@herobm/shared`.
 */
import * as fs from 'fs';
import * as path from 'path';
import {
  JOURNAL_ENTRY_SOURCE_TYPE,
  USER_SELECTABLE_JOURNAL_SOURCE_TYPES,
  TAKE_ON_JOURNAL_SOURCE_TYPES,
} from '@herobm/shared';

function findFiles(dir: string, pattern: RegExp): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name === 'dist') continue;
      results.push(...findFiles(fullPath, pattern));
    } else if (pattern.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

describe('Journal Entry Source Type Boundary (structural)', () => {
  const srcRoot = path.resolve(__dirname, '..');

  it('all known source types in JOURNAL_ENTRY_SOURCE_TYPE must be non-empty strings', () => {
    const entries = Object.entries(JOURNAL_ENTRY_SOURCE_TYPE);
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, value] of entries) {
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(0);
      expect(value).toMatch(/^[a-z_]+$/);
    }
  });

  it('USER_SELECTABLE_JOURNAL_SOURCE_TYPES and TAKE_ON_JOURNAL_SOURCE_TYPES must contain valid source types', () => {
    const allTypes = new Set<string>(Object.values(JOURNAL_ENTRY_SOURCE_TYPE));

    for (const type of USER_SELECTABLE_JOURNAL_SOURCE_TYPES) {
      expect(allTypes.has(type)).toBe(true);
    }

    for (const type of TAKE_ON_JOURNAL_SOURCE_TYPES) {
      expect(allTypes.has(type)).toBe(true);
    }
  });

  it('services constructing JournalMeta or calling postJournalEntry must not use hardcoded source type strings', () => {
    const knownSourceTypeStrings = new Set<string>(
      Object.values(JOURNAL_ENTRY_SOURCE_TYPE),
    );
    const serviceFiles = findFiles(srcRoot, /\.service\.ts$/).filter(
      (f) =>
        !f.includes('.spec.') && !f.includes('inventory-movement.service.ts'), // inventory-movement uses stock movement sourceType
    );

    const violations: { file: string; line: number; snippet: string }[] = [];

    for (const file of serviceFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const lines = src.split('\n');
      const relPath = path.relative(srcRoot, file).replace(/\\/g, '/');

      lines.forEach((lineText, idx) => {
        // Look for literal sourceType: 'xyz'
        const match = lineText.match(/sourceType\s*:\s*['"]([a-z_]+)['"]/);
        if (match) {
          const literal = match[1];
          if (knownSourceTypeStrings.has(literal)) {
            violations.push({
              file: relPath,
              line: idx + 1,
              snippet: lineText.trim(),
            });
          }
        }
      });
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line} — hardcoded sourceType string literal found:\n    ${v.snippet}`,
        )
        .join('\n\n');

      throw new Error(
        `\nJournal Entry Source Type Boundary Violations Found:\n\n${report}\n\n` +
          `Always use JOURNAL_ENTRY_SOURCE_TYPE.<NAME> from '@herobm/shared' instead of raw string literals.\n`,
      );
    }

    expect(violations).toHaveLength(0);
  });
});
