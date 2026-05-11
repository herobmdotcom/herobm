import * as fs from 'fs';
import * as path from 'path';
import {
  SALES_ORDER_STATE,
  PURCHASE_ORDER_STATE,
  BACKORDER_STATE,
  RETURN_STATE,
  PURCHASE_INVOICE_STATE,
  SALES_INVOICE_STATE,
} from '@modbm/shared';

describe('State Constants Architecture', () => {
  const rootDir = path.resolve(__dirname, '../..'); // apps/api
  const srcDir = path.join(rootDir, 'src');

  // List of states that should never be hardcoded as strings in business logic
  const prohibitedStates = [
    SALES_ORDER_STATE.DRAFT,
    SALES_ORDER_STATE.QUOTED,
    SALES_ORDER_STATE.CONFIRMED,
    SALES_ORDER_STATE.PICKING,
    SALES_ORDER_STATE.SHIPPED,
    SALES_ORDER_STATE.INVOICED,
    SALES_ORDER_STATE.CANCELLED,
    SALES_ORDER_STATE.ARCHIVED,
    SALES_ORDER_STATE.LEGACY,
    'allocated',
    BACKORDER_STATE.AWAITING_RECEIPT,
    BACKORDER_STATE.PENDING_SUPPLY,
    BACKORDER_STATE.RECEIVED_RESERVED,
    'received_unreserved',
    'dispatched',
    RETURN_STATE.RECEIVED,
    PURCHASE_INVOICE_STATE.PAID,
    PURCHASE_INVOICE_STATE.PARTIALLY_PAID,
    'released',
  ];

  // Regex patterns that typically indicate a hardcoded state check or assignment
  const patterns = [
    // Equality checks: stateCode === 'draft'
    new RegExp(
      `(?:stateCode|state|from|to|newState|status)\\s*(?:===|!==|==|!=)\\s*['"\`](${prohibitedStates.join('|')})['"\`]`,
      'g',
    ),
    // Assignments/Object properties: stateCode: 'draft' or action: 'draft'
    new RegExp(
      `(?:stateCode|state|from|to|newState|status)\\s*:\\s*['"\`](${prohibitedStates.join('|')})['"\`]`,
      'g',
    ),
    // Includes checks: ['draft', 'shipped'].includes(...)
    // This is a bit harder to regex precisely without false positives, but we can try looking for arrays of strings
    new RegExp(
      `\\[\\s*(?:['"\`](${prohibitedStates.join('|')})['"\`]\\s*,?\\s*)+\\]`,
      'g',
    ),
  ];

  // Exclude certain directories or file types
  const excludePatterns = [
    /\\.spec\\.ts$/, // Exclude tests as they often use mock data
    /drizzle-orm/,
    /node_modules/,
    /dist/,
  ];

  const getAllFiles = (dirPath: string, arrayOfFiles: string[] = []) => {
    const files = fs.readdirSync(dirPath);

    files.forEach((file) => {
      const fullPath = path.join(dirPath, file);
      if (fs.statSync(fullPath).isDirectory()) {
        arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
      } else {
        if (fullPath.endsWith('.ts')) {
          arrayOfFiles.push(fullPath);
        }
      }
    });

    return arrayOfFiles;
  };

  it('should not contain hardcoded state strings in business logic', () => {
    const files = getAllFiles(srcDir);
    const violations: string[] = [];

    files.forEach((file) => {
      if (
        file.endsWith('.spec.ts') ||
        excludePatterns.some((pattern) => pattern.test(file))
      ) {
        return;
      }

      const content = fs.readFileSync(file, 'utf-8');

      // Strip out comments to avoid false positives in explanations
      const contentWithoutComments = content
        .replace(new RegExp('//.*$', 'gm'), '')
        .replace(new RegExp('/\\\\*[\\\\s\\\\S]*?\\\\*/', 'g'), '');

      patterns.forEach((pattern) => {
        let match;
        while ((match = pattern.exec(contentWithoutComments)) !== null) {
          // Calculate line number for better reporting
          const linesBeforeMatch = contentWithoutComments
            .substring(0, match.index)
            .split('\\n');
          const lineNumber = linesBeforeMatch.length;

          violations.push(
            `Found hardcoded state '${match[1]}' in ${path.relative(rootDir, file)} at line ${lineNumber}\\nMatch: ${match[0].trim()}`,
          );
        }
      });
    });

    // If there are violations, the test fails
    if (violations.length > 0) {
      console.error('State Constant Violations Found:');
      violations.forEach((v) => console.error(v));
    }

    expect(violations.length).toBe(0);
  });
});
