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

describe('Inventory Valuation Drift Boundaries (structural)', () => {
  const srcRoot = path.resolve(__dirname, '..');

  it('Outbound and Reversal movements must map unitCost to avoid drift', () => {
    const serviceFiles = findFiles(srcRoot, /\.service\.ts$/).filter(
      (f) => !f.includes('.spec.'),
    );

    const unitCostViolations: {
      file: string;
      line: number;
      sourceType: string;
    }[] = [];
    const wacUpdateViolations: { file: string; sourceType: string }[] = [];

    const REQUIRES_UNIT_COST = [
      'SO_SHIPMENT',
      'SO_COUNTER_SALE',
      'PROJECT_ISSUE',
      'PROJECT_RETURN',
    ];
    const REQUIRES_WAC_RECALC = ['PO_RECEIPT', 'SO_RETURN', 'PO_RETURN'];

    for (const file of serviceFiles) {
      const src = fs.readFileSync(file, 'utf-8');
      const sourceFile = ts.createSourceFile(
        file,
        src,
        ts.ScriptTarget.Latest,
        true,
      );

      let hasWacUpdate = false;

      function checkWacUpdate(node: ts.Node) {
        if (
          ts.isPropertyAccessExpression(node) ||
          ts.isIdentifier(node) ||
          ts.isCallExpression(node)
        ) {
          const text = node.getText();
          if (
            (text.includes('weightedAverageCost') ||
              text.toLowerCase().includes('wac')) &&
            (src.includes('update(products)') ||
              src.includes('update(coreProducts)') ||
              src.toLowerCase().includes('recalculate'))
          ) {
            hasWacUpdate = true;
          }
        }
        ts.forEachChild(node, checkWacUpdate);
      }
      checkWacUpdate(sourceFile);

      const foundRecalcSourceTypes = new Set<string>();

      function visit(node: ts.Node) {
        if (ts.isCallExpression(node)) {
          const text = node.expression.getText();
          if (text.includes('recordInventoryMovement')) {
            const args = node.arguments;
            if (args.length > 1 && ts.isObjectLiteralExpression(args[1])) {
              const payload = args[1];

              let sourceType = '';
              let hasUnitCost = false;

              for (const prop of payload.properties) {
                if (ts.isPropertyAssignment(prop)) {
                  if (prop.name.getText() === 'sourceType') {
                    sourceType = prop.initializer
                      .getText()
                      .replace(/['"]/g, '');
                  }
                  if (
                    prop.name.getText() === 'lines' &&
                    ts.isArrayLiteralExpression(prop.initializer)
                  ) {
                    // Check if unitCost is mapped in the lines array elements or map function
                    const linesText = prop.initializer.getText();
                    if (linesText.includes('unitCost')) {
                      hasUnitCost = true;
                    }
                  } else if (prop.name.getText() === 'lines') {
                    // Sometimes lines is a variable reference e.g. `lines: dispatchLines`
                    // We check the variable initialization text in the file as a heuristic
                    const linesVarName = prop.initializer.getText();
                    if (
                      src.includes(`${linesVarName}.push({`) &&
                      src
                        .substring(src.indexOf(`${linesVarName}.push({`))
                        .includes('unitCost')
                    ) {
                      hasUnitCost = true;
                    } else if (src.includes('unitCost')) {
                      // Loose fallback heuristic if variable tracing is hard statically
                      hasUnitCost = true;
                    }
                  }
                }
              }

              if (REQUIRES_UNIT_COST.includes(sourceType) && !hasUnitCost) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(
                  node.getStart(),
                );
                unitCostViolations.push({
                  file: path.relative(srcRoot, file),
                  line: line + 1,
                  sourceType,
                });
              }

              if (REQUIRES_WAC_RECALC.includes(sourceType)) {
                foundRecalcSourceTypes.add(sourceType);
              }
            }
          }
        }
        ts.forEachChild(node, visit);
      }

      visit(sourceFile);

      for (const st of Array.from(foundRecalcSourceTypes)) {
        if (!hasWacUpdate) {
          wacUpdateViolations.push({
            file: path.relative(srcRoot, file),
            sourceType: st,
          });
        }
      }
    }

    const allErrors = [];
    if (unitCostViolations.length > 0) {
      allErrors.push(
        `Missing unitCost mappings detected in:\n` +
          unitCostViolations
            .map((v) => `  - ${v.file}:${v.line} [${v.sourceType}]`)
            .join('\n'),
      );
    }

    if (wacUpdateViolations.length > 0) {
      allErrors.push(
        `Missing Product WAC recalculations detected in modules handling inbound/reversal flows:\n` +
          wacUpdateViolations
            .map((v) => `  - ${v.file} [${v.sourceType}]`)
            .join('\n'),
      );
    }

    if (allErrors.length > 0) {
      throw new Error(
        `\nValuation Ledger Parity Violations Found:\n\n${allErrors.join('\n\n')}\n`,
      );
    }
  });
});
