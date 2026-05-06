/**
 * Inventory State Boundary — Structural Test
 *
 * This test guards against silent failures during inventory movements.
 * Whenever `recordInventoryMovement` is invoked, it must be guaranteed to execute
 * if the surrounding state update executes. Wrapping it in an optional
 * `if (bin) { ... }` block without throwing an error causes ledger desyncs.
 *
 * Root cause documented in: ADV-086
 *
 * The test statically reads every `.service.ts` file under `apps/api/src/`,
 * finds all calls to `recordInventoryMovement`, and ensures they are not
 * conditionally skipped with simple `if` blocks.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

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

describe('Inventory State Boundary (structural)', () => {
  const srcRoot = path.resolve(__dirname, '..');

  it('recordInventoryMovement must not be silently skipped in conditional blocks', () => {
    const serviceFiles = findFiles(srcRoot, /\.service\.ts$/).filter(
      (f) => !f.includes('.spec.'),
    );

    const violations: { file: string; line: number; snippet: string }[] = [];

    for (const file of serviceFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        src,
        ts.ScriptTarget.Latest,
        true,
      );

      function visit(node: ts.Node) {
        // Look for CallExpression
        if (ts.isCallExpression(node)) {
          const text = node.expression.getText();
          if (text.includes('recordInventoryMovement')) {
            // Find the ExpressionStatement containing this call
            let stmt: ts.Node = node;
            while (stmt && !ts.isExpressionStatement(stmt)) {
              stmt = stmt.parent;
            }

            if (stmt) {
              let isConditional = false;
              let ifStatement: ts.IfStatement | null = null;

              const parent = stmt.parent;
              // Case 1: if (foo) recordInventoryMovement()
              if (ts.isIfStatement(parent)) {
                isConditional = true;
                ifStatement = parent;
              }
              // Case 2: if (foo) { recordInventoryMovement() }
              else if (ts.isBlock(parent) && ts.isIfStatement(parent.parent)) {
                isConditional = true;
                ifStatement = parent.parent;
              }

              if (isConditional && ifStatement) {
                const conditionText = ifStatement.expression
                  .getText()
                  .toLowerCase();
                // Ignore valid logical guards that check if there are items to process
                if (conditionText.includes('length')) {
                  // This is a valid array length check, not a physical constraint skip
                  isConditional = false;
                }
              }

              if (isConditional && ifStatement) {
                const hasElse = !!ifStatement.elseStatement;
                let throwsInElse = false;

                if (hasElse) {
                  const elseText = ifStatement.elseStatement!.getText();
                  if (elseText.includes('throw new')) {
                    throwsInElse = true;
                  }
                }

                if (!throwsInElse) {
                  const { line } = sourceFile.getLineAndCharacterOfPosition(
                    node.getStart(),
                  );
                  violations.push({
                    file: path.relative(srcRoot, file),
                    line: line + 1,
                    snippet: text,
                  });
                }
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);
    }

    if (violations.length > 0) {
      const report = violations
        .map(
          (v) =>
            `  ${v.file}:${v.line} — Conditional check without error throw near inventory movement.\n    ${v.snippet}`,
        )
        .join('\n\n');

      throw new Error(
        `\nInventory State Boundary Violations Found:\n\n${report}\n\n` +
          `You cannot conditionally skip recordInventoryMovement inside an if-block without an else-throw branch.\n` +
          `If physical constraints prevent the movement, you must throw an error.\n` +
          `See: ADV-086 / docs/continuous_improvement/advisories/open/ADV-086.md`,
      );
    }
  });
});
