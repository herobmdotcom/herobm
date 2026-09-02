import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

function walk(dir: string): string[] {
  let results: string[] = [];
  const list = fs.readdirSync(dir);
  for (const file of list) {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      if (file === 'node_modules' || file === 'dist') continue;
      results = results.concat(walk(fullPath));
    } else if (file.endsWith('.service.ts') && !file.endsWith('.spec.ts')) {
      results.push(fullPath);
    }
  }
  return results;
}

interface Violation {
  file: string;
  line: number;
  kind: string;
  snippet: string;
}

function scanServiceFile(filePath: string, srcRoot: string): Violation[] {
  const content = fs.readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest,
    true,
  );
  const violations: Violation[] = [];

  function isDbQueryCall(node: ts.Node): boolean {
    if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr)) {
        const propName = expr.name.text;
        if (
          propName === 'select' ||
          propName === 'query' ||
          propName === 'findMany'
        ) {
          return true;
        }
      }
    }
    return false;
  }

  function checkLoopBody(loopNode: ts.Node, loopKind: string) {
    function visitInsideLoop(child: ts.Node) {
      if (isDbQueryCall(child)) {
        const { line } = sourceFile.getLineAndCharacterOfPosition(
          child.getStart(),
        );
        const allLines = content.split('\n');
        const lineText = allLines[line]?.trim() || '';
        const prevLineText = line > 0 ? allLines[line - 1]?.trim() || '' : '';

        if (
          !lineText.includes('n-plus-one-ignore') &&
          !prevLineText.includes('n-plus-one-ignore')
        ) {
          violations.push({
            file: path.relative(srcRoot, filePath).replace(/\\/g, '/'),
            line: line + 1,
            kind: loopKind,
            snippet: lineText,
          });
        }
      }
      ts.forEachChild(child, visitInsideLoop);
    }
    ts.forEachChild(loopNode, visitInsideLoop);
  }

  function visitor(node: ts.Node) {
    if (
      ts.isForStatement(node) ||
      ts.isForOfStatement(node) ||
      ts.isForInStatement(node) ||
      ts.isWhileStatement(node) ||
      ts.isDoStatement(node)
    ) {
      checkLoopBody(node, 'loop');
    } else if (ts.isCallExpression(node)) {
      const expr = node.expression;
      if (ts.isPropertyAccessExpression(expr) && expr.name.text === 'map') {
        const arg = node.arguments[0];
        if (arg && (ts.isArrowFunction(arg) || ts.isFunctionExpression(arg))) {
          const isAsync = arg.modifiers?.some(
            (m) => m.kind === ts.SyntaxKind.AsyncKeyword,
          );
          if (isAsync) {
            checkLoopBody(arg, 'async .map');
          }
        }
      }
    }
    ts.forEachChild(node, visitor);
  }

  visitor(sourceFile);
  return violations;
}

describe('Architecture - Database Queries (No N+1)', () => {
  // Baseline snapshot of legacy / stateful sequential operations.
  // When refactoring a subsystem to batch queries, remove resolved entries from this set.
  // ANY NEW N+1 query site outside of this baseline will fail the build immediately.
  const KNOWN_LEGACY_VIOLATIONS = new Set<string>([
    'gl/bank-feeds.service.ts:533',
    'gl/bank-feeds.service.ts:605',
    'gl/bank-feeds.service.ts:662',
    'gl/bank-statement.service.ts:379',
    'gl/bank-statement.service.ts:387',
    'goods-received/goods-received-write.service.ts:773',
    'goods-received/goods-received-write.service.ts:800',
    'inventory/inventory-movement.service.ts:323',
    'inventory/inventory-movement.service.ts:374',
    'inventory/inventory-movement.service.ts:419',
    'inventory/inventory-movement.service.ts:459',
    'inventory/inventory-movement.service.ts:511',
    'inventory/inventory-movement.service.ts:549',
    'inventory/inventory-movement.service.ts:589',
    'inventory/inventory-movement.service.ts:593',
    'inventory/inventory-movement.service.ts:625',
    'inventory/inventory-movement.service.ts:679',
    'inventory/inventory-movement.service.ts:685',
    'inventory/inventory-movement.service.ts:695',
    'inventory/inventory-movement.service.ts:715',
    'inventory/inventory-movement.service.ts:1096',
    'inventory/inventory-movement.service.ts:1103',
    'inventory/inventory-movement.service.ts:1115',
    'inventory/inventory-movement.service.ts:1170',
    'inventory/inventory-movement.service.ts:1272',
    'inventory/inventory-movement.service.ts:1278',
    'invoices/sales-credit-note.service.ts:331',
    'invoices/sales-credit-note.service.ts:855',
    'invoices/sales-credit-note.service.ts:938',
    'invoices/sales-credit-note.service.ts:1067',
    'invoices/sales-credit-note.service.ts:1247',
    'orders/backorders.service.ts:454',
    'orders/backorders.service.ts:610',
    'orders/backorders.service.ts:929',
    'orders/counter-fulfillment.service.ts:168',
    'orders/returns-write.service.ts:232',
    'orders/returns-write.service.ts:620',
    'orders/returns-write.service.ts:637',
    'orders/returns-write.service.ts:1098',
    'orders/returns-write.service.ts:1104',
    'orders/shipments/shipments-core.service.ts:326',
    'orders/shipments/shipments-state.service.ts:209',
    'orders/shipments/shipments-state.service.ts:333',
    'orders/shipments/shipments-state.service.ts:393',
    'orders/shipments/shipments-state.service.ts:585',
    'orders/shipments/shipments-state.service.ts:639',
    'orders/shipments/shipments-write.service.ts:200',
    'payments/payments-allocation.service.ts:204',
    'payments/payments-allocation.service.ts:222',
    'payments/payments-allocation.service.ts:386',
    'payments/payments-allocation.service.ts:533',
    'payments/payments-allocation.service.ts:539',
    'payments/payments-posting.service.ts:186',
    'payments/payments-posting.service.ts:192',
    'payments/payments-write.service.ts:247',
    'purchase-debit-notes/purchase-debit-notes.service.ts:131',
    'purchase-debit-notes/purchase-debit-notes.service.ts:143',
    'purchase-debit-notes/purchase-debit-notes.service.ts:247',
    'purchase-debit-notes/purchase-debit-notes.service.ts:464',
    'purchase-orders/purchase-orders-state.service.ts:147',
    'purchase-orders/purchase-orders-write.service.ts:271',
    'purchase-orders/purchase-returns.service.ts:186',
    'purchase-orders/purchase-returns.service.ts:266',
    'purchase-orders/purchase-returns.service.ts:389',
    'purchase-orders/purchase-returns.service.ts:594',
    'purchase-orders/purchase-returns.service.ts:664',
    'purchase-orders/purchase-returns.service.ts:797',
  ]);

  it('should not contain any new un-batched N+1 queries in service files', () => {
    const srcDir = path.resolve(__dirname, '..');
    const serviceFiles = walk(srcDir);
    const allViolations: Violation[] = [];

    for (const file of serviceFiles) {
      allViolations.push(...scanServiceFile(file, srcDir));
    }

    const newViolations = allViolations.filter(
      (v) => !KNOWN_LEGACY_VIOLATIONS.has(`${v.file}:${v.line}`),
    );

    if (newViolations.length > 0) {
      const report = newViolations
        .map((v) => `  ${v.file}:${v.line} (${v.kind})\n    ${v.snippet}`)
        .join('\n\n');

      throw new Error(
        `\nNew N+1 Database Query Violations Introduced:\n\n${report}\n\n` +
          `Batch your queries using inArray(), WHERE id IN (...), or pre-fetched lookup maps.\n`,
      );
    }

    expect(newViolations).toEqual([]);
  });

  it('should track known legacy violations and prevent stale tracking entries', () => {
    const srcDir = path.resolve(__dirname, '..');
    const serviceFiles = walk(srcDir);
    const activeViolations = new Set<string>();

    for (const file of serviceFiles) {
      const violations = scanServiceFile(file, srcDir);
      for (const v of violations) {
        activeViolations.add(`${v.file}:${v.line}`);
      }
    }

    const resolvedEntries: string[] = [];
    for (const legacy of KNOWN_LEGACY_VIOLATIONS) {
      if (!activeViolations.has(legacy)) {
        resolvedEntries.push(legacy);
      }
    }

    // If an entry is fixed, remove it from KNOWN_LEGACY_VIOLATIONS to ratchet down tech debt.
    expect(resolvedEntries).toEqual([]);
  });
});
